import { Inject, Injectable } from '@nestjs/common';
import { generateOtp, hashOtp, safeEqualHex } from './otp.util';
import { OtpPurpose } from '@/generated/prisma/enums';
import { Otp } from '@/generated/prisma/client';
import { otpConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { InvalidOrExpiredCode } from '@/common/exceptions/auth/invalid-or-expired-code.exception';
import { OtpAttemptsExceeded } from '@/common/exceptions/auth/otp-attempts-exceeded.exception';
import { UsersService } from '@/users/users.service';

export type IssueOtpResult =
  | { issued: true; otp: Otp; code: string }
  | {
      issued: false;
      reason: 'COOLDOWN' | 'HOURLY_LIMIT';
      retryAfterSeconds: number;
    };

@Injectable()
export class OtpServices {
  constructor(
    @Inject(otpConfig.KEY)
    private readonly otpCfg: ConfigType<typeof otpConfig>,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async invalidateAuthOtp(verificationId: string): Promise<void> {
    await this.prisma.otp.updateMany({
      where: {
        id: verificationId,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });
  }

  async findById(
    verificationId: string,
  ): Promise<Prisma.OtpGetPayload<{ include: { user: true } }> | null> {
    return this.prisma.otp.findUnique({
      where: {
        id: verificationId,
      },
      include: { user: true },
    });
  }

  async verifyOtp(
    verificationId: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<Prisma.OtpGetPayload<{ include: { user: true } }>> {
    const maxAttempts: number = this.otpCfg.otpMaxAttempts;
    let otp: Prisma.OtpGetPayload<{ include: { user: true } }>;

    try {
      otp = await this.prisma.otp.update({
        where: {
          id: verificationId,
          purpose,
          consumedAt: null,
          invalidatedAt: null,
          expiresAt: {
            gt: new Date(),
          },
          attemptCount: { lt: maxAttempts },
        },
        data: {
          attemptCount: {
            increment: 1,
          },
        },
        include: {
          user: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2025'
      )
        throw new InvalidOrExpiredCode();
      throw e;
    }

    const codeHash = hashOtp(code, this.otpCfg.otpHmacSecret);

    if (!safeEqualHex(codeHash, otp.otpHash)) {
      if (otp.attemptCount === maxAttempts) {
        await this.invalidateAuthOtp(verificationId);
        throw new OtpAttemptsExceeded();
      } else throw new InvalidOrExpiredCode();
    }
    return otp;
  }

  async issue(
    userId: string,
    purpose: OtpPurpose,
    tx: Prisma.TransactionClient,
  ): Promise<IssueOtpResult> {
    await this.usersService.lockForUpdate(userId, tx);
    const now = Date.now();
    const recent = await tx.otp.findMany({
      where: { userId, purpose, createdAt: { gte: new Date(now - 3_600_000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const latest = recent[0] ?? null;

    if (latest !== null) {
      const readyAt =
        latest.createdAt.getTime() +
        this.otpCfg.otpResendCooldownSeconds * 1000;
      const waitMs = readyAt - now;
      if (waitMs > 0) {
        return {
          issued: false,
          reason: 'COOLDOWN',
          retryAfterSeconds: Math.ceil(waitMs / 1000),
        };
      }
    }

    if (recent.length >= this.otpCfg.otpMaxIssuesPerHour) {
      const freeAt = recent[recent.length - 1].createdAt.getTime() + 3_600_000;
      return {
        issued: false,
        reason: 'HOURLY_LIMIT',
        retryAfterSeconds: Math.ceil((freeAt - now) / 1000),
      };
    }

    await tx.otp.updateMany({
      where: {
        userId,
        purpose,
        consumedAt: null,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(now),
      },
    });

    const newOtpGenerated = generateOtp();
    const hashGeneratedOtp = hashOtp(
      newOtpGenerated,
      this.otpCfg.otpHmacSecret,
    );

    const newOtpRecord = await tx.otp.create({
      data: {
        userId,
        otpHash: hashGeneratedOtp,
        purpose,
        expiresAt: new Date(now + this.otpCfg.otpTtlSeconds * 1000),
        attemptCount: 0,
      },
    });
    return { issued: true, otp: newOtpRecord, code: newOtpGenerated };
  }
}
