import { maskEmail, safeEqualHex } from './otp/otp.util';
import { OtpServices } from './otp/otp.service';
import { UsersService } from './../users/users.service';
import {
  ConflictException,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  Inject,
  Logger,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, Purpose } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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
    if (existingUser?.emailVerifiedAt) {
      throw new EmailAlreadyVerified();
    }

    if (existingUser) {
      const latest = await this.prisma.authOtps.findFirst({
        where: {
          userId: existingUser.id,
          purpose: Purpose.VERIFY_EMAIL,
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
            phone: dto.phone ?? null,
            dateOfBirth: dto.dateOfBirth
              ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
              : null,
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
      existingVerification.purpose !== Purpose.VERIFY_EMAIL
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

    const authOtpsCount = await this.prisma.authOtps.update({
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
      const consumed = await tx.authOtps.updateMany({
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
          emailVerifiedAt: new Date(),
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

    if (!existedOtp || existedOtp.purpose !== Purpose.VERIFY_EMAIL)
      throw new OtpNotFound();

    if (existedOtp.user.emailVerifiedAt !== null)
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
        select: { emailVerifiedAt: true },
      });

      if (selectedIdVerification.emailVerifiedAt)
        throw new EmailAlreadyVerified();

      const latestOtpGenerated = await tx.authOtps.findFirst({
        where: {
          userId: existedOtp.user.id,
          purpose: Purpose.VERIFY_EMAIL,
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
      const allRecordInAnHour = await tx.authOtps.findMany({
        where: {
          userId: existedOtp.user.id,
          purpose: Purpose.VERIFY_EMAIL,
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

      await tx.authOtps.updateMany({
        where: {
          userId: existedOtp.userId,
          purpose: Purpose.VERIFY_EMAIL,
          consumedAt: null,
          invalidatedAt: null,
        },
        data: {
          invalidatedAt: new Date(),
        },
      });

      const authOtps = await tx.authOtps.create({
        data: {
          userId: existedOtp.userId,
          otpHash: hashGeneratedOtp,
          purpose: Purpose.VERIFY_EMAIL,
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

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      include: {
        customer: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.emailVerifiedAt === null) {
      throw new ForbiddenException(
        'Vui lòng xác thực email trước khi đăng nhập',
      );
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

    await this.prisma.refreshTokens.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        customer: user.customer
          ? {
              id: user.customer.id,
              fullName: user.customer.fullName,
              phone: user.customer.phone,
              dateOfBirth: user.customer.dateOfBirth,
            }
          : null,
      },
    };
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
            phone: true,
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

  async refresh(rawRefreshToken: string) {
    const currentTokenHash = this.hashRefreshToken(rawRefreshToken);

    const now = new Date();

    const storedToken = await this.prisma.refreshTokens.findUnique({
      where: { tokenHash: currentTokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt <= now ||
      storedToken.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const newRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashRefreshToken(newRefreshToken);

    const payload = {
      sub: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };
    const newAccessToken = await this.jwtService.signAsync(payload);

    const rotationResult = await this.prisma.refreshTokens.updateMany({
      where: {
        id: storedToken.id,
        tokenHash: currentTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        tokenHash: newTokenHash,
        lastUsedAt: now,
      },
    });

    if (rotationResult.count !== 1) {
      throw new UnauthorizedException('Failed to refresh token');
    }

    return {
      accessToken: newAccessToken,
      expiresAt: this.getAccessTokenTtlSeconds(),

      newRefreshToken,
      refreshTokenExpiresAt: storedToken.expiresAt, // Keep the original expiration date for the new token
    };
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

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    await this.prisma.refreshTokens.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
