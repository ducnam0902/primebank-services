import { generateCifNumber, maskEmail, safeEqualHex } from './otp/otp.util';
import { IIssueVerifyOtp, OtpServices } from './otp/otp.service';
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
import { EmailAlreadyRegistered } from '@/common/exceptions/auth/email-already-registered.exception';
import { PhoneAlreadyRegistered } from '@/common/exceptions/auth/phone-already-registered.exception';
import { NationalIdAlreadyRegistered } from '@/common/exceptions/auth/national-id-already-registered.exception';
import { USER_SELECT } from '@/users/users.select';
import { getUniqueConstraintFields } from '@/common/utils/prisma-error.util';
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

  private static readonly MAX_CIF_RETRIES = 3;

  async register(dto: RegisterDto): Promise<VerificationDto> {
    const email = dto.email.toLowerCase().trim();
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const result = await this.createCustomerAndIssueOtp(
      email,
      passwordHash,
      dto,
    );

    try {
      await this.emailService.sendVerificationCode({
        email: result.email,
        code: result.otp,
        verificationId: result.authOtps.id,
        expiresInMinutes: Math.ceil(this.otpCfg.otpTtlSeconds / 60),
      });
    } catch (error) {
      this.logger.error('Send email verification failed', {
        userId: result.authOtps.userId,
        verificationId: result.authOtps.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return buildOtpResponse(
      result.authOtps,
      result.email,
      this.otpCfg.otpResendCooldownSeconds,
    );
  }

  private async createCustomerAndIssueOtp(
    email: string,
    passwordHash: string,
    dto: RegisterDto,
  ): Promise<Awaited<ReturnType<OtpServices['issueVerifyOtp']>>> {
    for (let attempt = 1; attempt <= AuthService.MAX_CIF_RETRIES; attempt++) {
      const generatedCifNumber = generateCifNumber();
      try {
        const newOtp = generateOtp();
        return await this.prisma.$transaction(async (tx) => {
          const reused = await this.reuseUnverifiedUser(
            tx,
            email,
            passwordHash,
            dto,
            newOtp,
          );
          if (reused) return reused;

          const user = await this.usersService.create(
            { email, passwordHash },
            tx,
          );

          await this.customerService.create(
            {
              userId: user.id,
              fullName: dto.fullName,
              phoneNumber: dto.phoneNumber,
              dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
              cifNumber: generatedCifNumber,
              nationalId: dto.nationalId,
              address: dto.address,
            },
            tx,
          );
          return this.otpService.issueVerifyOtp(user, newOtp, tx);
        });
      } catch (error: unknown) {
        if (!(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )) {
          throw error;
        }

        const fields = getUniqueConstraintFields(error);

        if (fields.includes('cif_number')) {
          if (attempt < AuthService.MAX_CIF_RETRIES) continue;
          this.logger.error('CIF number generation exhausted retries', {
            attempt,
          });
          throw new ConflictException(
            'Unable to generate a unique CIF number, please try again',
          );
        }
        if (fields.includes('email')) throw new EmailAlreadyRegistered();
        if (fields.includes('phone_number')) throw new PhoneAlreadyRegistered();
        if (fields.includes('national_id'))
          throw new NationalIdAlreadyRegistered();

        this.logger.error('Unmapped unique constraint violation on register', {
          fields,
        });
        throw new ConflictException('Duplicate data');
      }
    }

    // Unreachable: every loop iteration above either returns or throws.
    throw new ConflictException(
      'Unable to generate a unique CIF number, please try again',
    );
  }

  private async reuseUnverifiedUser(
    tx: Prisma.TransactionClient,
    email: string,
    passwordHash: string,
    dto: RegisterDto,
    otp: string,
  ): Promise<IIssueVerifyOtp | null> {
    const existing = await tx.user.findUnique({
      where: { email },
      select: { id: true, status: true },
    });
    if (existing?.status !== UserStatus.PENDING_VERIFICATION) return null;

    await tx.$queryRaw`
      SELECT id FROM users WHERE id = ${existing.id}::uuid FOR NO KEY UPDATE
    `;

    // Same throttling as resendVerification, so re-registering cannot be
    // used to bypass the OTP rate limits.
    const recent = await tx.otp.findMany({
      where: {
        userId: existing.id,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        createdAt: { gte: new Date(Date.now() - 3600_000) },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    if (recent.length > 0) {
      const waitMs =
        recent[recent.length - 1].createdAt.getTime() +
        this.otpCfg.otpResendCooldownSeconds * 1000 -
        Date.now();
      if (waitMs > 0) throw new OtpResendTooSoon(Math.ceil(waitMs / 1000));
    }
    if (recent.length >= this.otpCfg.otpMaxIssuesPerHour) {
      const freeAt = recent[0].createdAt.getTime() + 3600_000;
      throw new OtpResendLimitReached(Math.ceil((freeAt - Date.now()) / 1000));
    }

    const user = await tx.user.update({
      where: { id: existing.id },
      data: { passwordHash },
      select: USER_SELECT,
    });
    await tx.customer.update({
      where: { userId: existing.id },
      data: {
        fullName: dto.fullName,
        phoneNumber: dto.phoneNumber,
        dateOfBirth: new Date(`${dto.dateOfBirth}T00:00:00.000Z`),
        nationalId: dto.nationalId,
        address: dto.address,
      },
    });
    return this.otpService.issueVerifyOtp(user, otp, tx);
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

    const codeHash = hashOtp(code, this.otpCfg.otpHmacSecret);
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
    const hashGeneratedOtp = hashOtp(
      newOtpGenerated,
      this.otpCfg.otpHmacSecret,
    );

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
