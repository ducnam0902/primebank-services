import { maskEmail, safeEqualHex } from './otp/otp.util';
import { OtpServices } from './otp/otp.service';
import { UsersService } from './../users/users.service';
import {
  ConflictException,
  Injectable,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, OtpPurpose, UserStatus } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

import { EmailService } from '../email/email.service';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { jwtConfig, otpConfig } from '../config';
import type { ConfigType } from '@nestjs/config';
import { VerificationDto } from './dto/verification-response.dto';
import { EmailAlreadyVerified } from '@/common/exceptions/auth/email-already-verified.exception';
import { buildOtpResponse, generateOtp, hashOtp } from '@/auth/otp/otp.util';
import { CustomersService } from '@/customers/customers.service';
import { VerifyEmailResponse } from './dto/verify-email.response.dto';
import { OtpNotFound } from '@/common/exceptions/auth/otp-not-found.exception';
import {
  OtpExpired,
  OtpReason,
} from '@/common/exceptions/auth/otp-expired.exception';
import { OtpTooManyAttempts } from '@/common/exceptions/auth/otp-too-many-attempts.exception';
import { OtpInvalid } from '@/common/exceptions/auth/otp-invalid.exception';
import { OtpResendTooSoon } from '@/common/exceptions/auth/otp-resend-too-soon.exception';
import { OtpResendLimitReached } from '@/common/exceptions/auth/otp-resend-limit-reached.exception';
@Injectable()
export class AuthService {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
    @Inject(otpConfig.KEY)
    private readonly otpCfg: ConfigType<typeof otpConfig>,

    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly customerService: CustomersService,
    private readonly jwtService: JwtService,
    private readonly otpService: OtpServices,
    private readonly logger: Logger,
  ) {}

  async register(dto: RegisterDto): Promise<VerificationDto> {
    const email = dto.email.toLowerCase().trim();
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser?.status !== UserStatus.PENDING_VERIFICATION) {
      throw new EmailAlreadyVerified();
    }

    if (existingUser) {
      const latest = await this.prisma.otp.findFirst({
        where: {
          userId: existingUser.id,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          invalidatedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (latest) {
        const elapsed = Math.floor(
          (Date.now() - latest.createdAt.getTime()) / 1000,
        );
        const remaining = this.otpCfg.otpResendCooldownSeconds - elapsed;
        if (remaining > 0) {
          return buildOtpResponse(latest, existingUser.email, remaining);
        }
      }

      const result = await this.prisma.$transaction(async (tx) =>
        this.otpService.issueVerifyOtp(existingUser, tx),
      );

      await this.emailService.sendVerificationCode({
        email: existingUser.email,
        code: result.otp,
        verificationId: result.authOtps.id,
        expiresInMinutes: Math.ceil(this.otpCfg.otpTtlSeconds / 60),
      });

      return buildOtpResponse(
        result.authOtps,
        existingUser.email,
        this.otpCfg.otpResendCooldownSeconds,
      );
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await this.usersService.create(
          {
            email,
            passwordHash,
          },
          tx,
        );

        await this.customerService.create(
          {
            userId: user.id,
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
            cifNumber: '',
            nationalId: '',
            address: '',
          },
          tx,
        );
        return this.otpService.issueVerifyOtp(user, tx);
      });

      await this.emailService.sendVerificationCode({
        email: result.email,
        code: result.otp,
        verificationId: result.authOtps.id,
        expiresInMinutes: Math.ceil(this.otpCfg.otpTtlSeconds / 60),
      });

      return buildOtpResponse(
        result.authOtps,
        result.email,
        this.otpCfg.otpResendCooldownSeconds,
      );
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const target = error.meta?.target;
        const fields = Array.isArray(target)
          ? target.join(',')
          : String(target);
        throw new ConflictException(
          fields.includes('email')
            ? 'Email already in use'
            : 'Phone number already in use',
        );
      }
      throw error;
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const { verificationId, code } = dto;
    const maxAttempts: number = this.otpCfg.otpMaxAttempts ?? 5;
    const existingVerification = await this.otpService.findById(verificationId);
    if (
      !existingVerification ||
      existingVerification.purpose !== OtpPurpose.EMAIL_VERIFICATION
    ) {
      throw new OtpNotFound();
    }

    if (existingVerification.consumedAt != null) {
      throw new OtpExpired(OtpReason.CONSUMED);
    }

    if (existingVerification.invalidatedAt != null) {
      throw new OtpExpired(OtpReason.SUPERSEDED);
    }

    if (existingVerification.expiresAt <= new Date()) {
      await this.otpService.invalidateAuthOtp(verificationId);
      throw new OtpExpired(OtpReason.EXPIRED);
    }

    const authOtpsCount = await this.prisma.otp.update({
      where: {
        id: verificationId,
      },
      data: {
        attemptCount: {
          increment: 1,
        },
      },
    });

    const attemptsLeft = Math.max(0, maxAttempts - authOtpsCount.attemptCount);

    if (authOtpsCount.attemptCount > maxAttempts) {
      await this.otpService.invalidateAuthOtp(verificationId);
      throw new OtpTooManyAttempts();
    }

    const codeHash = hashOtp(code);
    if (!safeEqualHex(codeHash, existingVerification.otpHash)) {
      throw new OtpInvalid(attemptsLeft);
    }

    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.otp.updateMany({
        where: {
          id: verificationId,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          consumedAt: new Date(),
        },
      });

      if (consumed.count === 0) {
        throw new OtpExpired(OtpReason.CONSUMED);
      }

      const user = await tx.user.update({
        where: {
          id: existingVerification.userId,
        },
        data: {
          status: UserStatus.ACTIVE,
        },
      });

      return {
        verified: true,
        maskedEmail: maskEmail(user.email),
        nextStep: 'LOGIN',
      };
    });
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<VerificationDto> {
    const existedOtp = await this.otpService.findById(dto.verificationId);

    if (!existedOtp || existedOtp.purpose !== OtpPurpose.EMAIL_VERIFICATION)
      throw new OtpNotFound();

    if (existedOtp.user.status !== UserStatus.PENDING_VERIFICATION)
      throw new EmailAlreadyVerified();

    const newOtpGenerated = generateOtp();
    const hashGeneratedOtp = hashOtp(newOtpGenerated);

    const newOtp = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
      SELECT id FROM users WHERE id = ${existedOtp.userId}::uuid FOR NO KEY UPDATE
    `;
      const selectedIdVerification = await tx.user.findUniqueOrThrow({
        where: {
          id: existedOtp.user.id,
        },
        select: { status: true },
      });

      if (selectedIdVerification.status !== UserStatus.PENDING_VERIFICATION)
        throw new EmailAlreadyVerified();

      const latestOtpGenerated = await tx.otp.findFirst({
        where: {
          userId: existedOtp.user.id,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          createdAt: true,
        },
      });

      if (latestOtpGenerated != null) {
        const readyAt =
          latestOtpGenerated.createdAt.getTime() +
          this.otpCfg.otpResendCooldownSeconds * 1000;
        const waitMs = readyAt - Date.now();
        if (waitMs > 0) throw new OtpResendTooSoon(Math.ceil(waitMs / 1000));
      }

      const windowStart = new Date(Date.now() - 3600_000);
      const allRecordInAnHour = await tx.otp.findMany({
        where: {
          userId: existedOtp.user.id,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          createdAt: {
            gte: windowStart,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          createdAt: true,
        },
      });

      if (allRecordInAnHour.length >= this.otpCfg.otpMaxIssuesPerHour) {
        const freeAt = allRecordInAnHour[0].createdAt.getTime() + 3600_000;
        throw new OtpResendLimitReached(
          Math.ceil((freeAt - Date.now()) / 1000),
        );
      }

      await tx.otp.updateMany({
        where: {
          userId: existedOtp.userId,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      const authOtps = await tx.otp.create({
        data: {
          userId: existedOtp.userId,
          otpHash: hashGeneratedOtp,
          purpose: OtpPurpose.EMAIL_VERIFICATION,
          expiresAt: new Date(Date.now() + this.otpCfg.otpTtlSeconds * 1000),
          attemptCount: 0,
        },
      });

      return {
        authOtps,
      };
    });

    try {
      await this.emailService.sendVerificationCode({
        email: existedOtp.user.email,
        code: newOtpGenerated,
        verificationId: newOtp.authOtps.id,
        expiresInMinutes: Math.ceil(this.otpCfg.otpTtlSeconds / 60),
      });
    } catch (error) {
      this.logger.error('Send email verification failed', {
        userId: existedOtp.userId,
        verificationId: newOtp.authOtps.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return buildOtpResponse(
      newOtp.authOtps,
      existedOtp.user.email,
      this.otpCfg.otpResendCooldownSeconds,
    );
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            dateOfBirth: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    return user;
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiresAt(): Date {
    const ttlDays = Number(this.jwtCfg.refreshExpiresIn) || 7;

    if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
      throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive number');
    }

    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000); // Convert days to milliseconds
  }

  private getAccessTokenTtlSeconds(): number {
    return Number(this.jwtCfg.accessExpiresIn) || 900; // Default to 15 minutes
  }
}
