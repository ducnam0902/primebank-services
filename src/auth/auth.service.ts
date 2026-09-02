import {
  ConflictException,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  GoneException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma, Purpose } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import repeat from 'lodash/repeat';
import { EmailService } from '../email/email.service';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { ResendVerificationDto } from './dto/resendVerification.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    // const existingUser = await this.prisma.user.findUnique({
    //   where: {
    //     email: dto.email,
    //   },
    // });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        //Check email exists or not create new or send otp
        const existingUser = await tx.user.findUnique({
          where: {
            email: dto.email,
          },
        });
        let user = existingUser;
        let customer;

        if (user === null) {
          user = await tx.user.create({
            data: {
              email: dto.email,
              passwordHash,
            },
          });

          customer = await tx.customer.create({
            data: {
              userId: user.id,
              fullName: dto.fullName,
              phone: dto.phone ?? null,
              dateOfBirth: dto.dateOfBirth
                ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
                : null,
            },
          });
        }

        const otp = this.generateOtp();
        const codeHash = this.hashOtp(otp);
        const authOtps = await tx.authOtps.create({
          data: {
            userId: user.id,
            otpHash: codeHash, // Replace with actual hashed OTP
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
            purpose: 'VERIFY_EMAIL',
            attemptCount: 0,
          },
        });

        return {
          user,
          customer,
          authOtps,
          otp,
        };
      });

      await this.emailService.sendVerificationCode({
        email: result.user.email,
        code: result.otp,
        verificationId: result.authOtps.id,
        expiresInMinutes: 5,
      });

      return {
        message: 'Mã OTP đã được gửi tới email thành công',
        verificationRequired: true,
        verificationId: result.authOtps.id,
        maskedEmail: this.maskEmail(result.user.email),
        otpExpiresAt: result.authOtps.expiresAt,
        otpTtl: 300, // 5 minutes in seconds
        expiresIn: Math.max(
          0,
          Math.floor((result.authOtps.expiresAt.getTime() - Date.now()) / 1000),
        ),
        resendAfter: 60,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Số điện thoại hoặc email đã tồn tại');
      }

      throw error;
    }
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

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private maskEmail(email: string): string {
    return email.replace(
      /(.{2})(.*)(?=@)/,
      (_, visible: string, hidden: string) =>
        visible.concat(repeat('*', hidden.length)),
    );
  }

  private hashOtp(otp: string): string {
    return createHash('sha256').update(otp).digest('hex');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiresAt(): Date {
    const ttlDays =
      Number(this.configService.get('REFRESH_TOKEN_TTL_DAYS')) || 7;

    if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
      throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive number');
    }

    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000); // Convert days to milliseconds
  }

  private getAccessTokenTtlSeconds(): number {
    return Number(this.configService.get('JWT_ACCESS_TTL_SECONDS')) || 900; // Default to 15 minutes
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

  async verifyEmail(dto: VerifyEmailDto) {
    const { verificationId, code } = dto;
    const maxAttempts: number = this.configService.get('MAX_ATTEMPTS') || 5;
    const existingVerification = await this.prisma.authOtps.findUnique({
      where: {
        id: verificationId,
      },
    });
    if (!existingVerification?.id) {
      throw new NotFoundException('Không tồn tại thông tin đăng kí');
    }

    if (existingVerification.purpose !== Purpose.VERIFY_EMAIL) {
      throw new Error('OTP đã gửi không đúng mục đích');
    }

    if (existingVerification.expiresAt <= new Date()) {
      throw new GoneException('OTP đã gửi hết hạn');
    }

    if (existingVerification.attemptCount >= maxAttempts) {
      throw new Error('Qúa nhiều request được gửi');
    }

    const hashOtp = this.hashOtp(code);
    if (existingVerification.otpHash !== hashOtp) {
      await this.prisma.authOtps.update({
        where: {
          id: verificationId,
        },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
      });

      throw new Error('Mã OTP nhập sai');
    }

    if (existingVerification.otpHash === hashOtp) {
      await this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: {
            id: existingVerification.userId,
          },
          data: {
            emailVerifiedAt: new Date(),
          },
        });
        return {
          message: 'Email verified successfully',
        };
      });
    }
  }

  async resendVerification(dto: ResendVerificationDto) {
    const existedVerification = await this.prisma.authOtps.findUnique({
      where: {
        id: dto.verificationId,
      },
      select: {
        userId: true,
        purpose: true,
        user: {
          select: {
            email: true,
            emailVerifiedAt: true,
          },
        },
      },
    });

    if (
      !existedVerification ||
      existedVerification.purpose !== Purpose.VERIFY_EMAIL
    ) {
      throw new BadRequestException({
        message: 'Invalid verification request',
        code: 'VERIFICATION_INVALID',
      });
    }

    if (existedVerification.user.emailVerifiedAt !== null) {
      throw new ConflictException({
        message: 'Email has already been verified',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    const resendAfterSeconds = 60;
    let retryAfter;

    const latestVerification = await this.prisma.authOtps.findFirst({
      where: {
        userId: dto.verificationId,
        purpose: Purpose.VERIFY_EMAIL,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    if (latestVerification) {
      const resendAllowedAt =
        latestVerification.createdAt.getTime() + resendAfterSeconds * 1000;
      if (Date.now() < resendAllowedAt) {
        retryAfter = Math.ceil((resendAllowedAt - Date.now()) / 1000);
      }

      throw new HttpException(
        {
          message: 'Mã OTP cũ vẫn đang còn hiệu lực. Vui lòng thử lại sau',
          code: 'OTP_RESEND_TOO_SOON',
          retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = this.generateOtp();
    const codeHash = this.hashOtp(otp);

    const newVerification = await this.prisma.$transaction(
      async (tx) => {
        return tx.authOtps.create({
          data: {
            userId: existedVerification.userId,
            otpHash: codeHash, // Replace with actual hashed OTP
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
            purpose: Purpose.VERIFY_EMAIL,
            attemptCount: 0,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.emailService.sendVerificationCode({
      email: existedVerification.user.email,
      code: otp,
      verificationId: newVerification.id,
      expiresInMinutes: 5,
    });

    return {
      message: 'Mã OTP mới đã được gửi',
      verificationId: newVerification.id,
      expiresIn: Math.max(
        0,
        Math.floor((newVerification.expiresAt.getTime() - Date.now()) / 1000),
      ),
      resendAfter: resendAfterSeconds,
    };
  }
}
