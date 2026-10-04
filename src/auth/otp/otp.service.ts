import { Inject, Injectable } from '@nestjs/common';
import { hashOtp, safeEqualHex } from './otp.util';
import { OtpPurpose } from '@/generated/prisma/enums';
import { Otp } from '@/generated/prisma/client';
import { otpConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { UserSelected } from '@/users/users.select';
import { PrismaService } from '@/database/prisma.service';
import { InvalidOrExpiredCode } from '@/common/exceptions/auth/invalid-or-expired-code.exception';
import { OtpAttemptsExceeded } from '@/common/exceptions/auth/otp-attempts-exceeded.exception';
export interface IIssueVerifyOtp {
  otp: string;
  authOtps: Otp;
  email: string;
}

@Injectable()
export class OtpServices {
  constructor(
    @Inject(otpConfig.KEY)
    private readonly otpCfg: ConfigType<typeof otpConfig>,
    private readonly prisma: PrismaService,
  ) {}

  async issueVerifyOtp(
    user: UserSelected,
    otp: string,
    tx: Prisma.TransactionClient,
  ): Promise<IIssueVerifyOtp> {
    await tx.otp.updateMany({
      where: {
        userId: user.id,
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });
    const authOtps = await tx.otp.create({
      data: {
        userId: user.id,
        otpHash: hashOtp(otp, this.otpCfg.otpHmacSecret),
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + this.otpCfg.otpTtlSeconds * 1000),
        attemptCount: 0,
      },
    });

    return {
      otp,
      authOtps,
      email: user.email,
    };
  }

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
    const maxAttempts: number = this.otpCfg.otpMaxAttempts ?? 5;
    const existingOtp = await this.findById(verificationId);

    if (
      !existingOtp ||
      existingOtp.purpose !== purpose ||
      existingOtp.consumedAt != null ||
      existingOtp.invalidatedAt != null
    ) {
      throw new InvalidOrExpiredCode();
    }

    if (existingOtp.expiresAt <= new Date()) {
      await this.invalidateAuthOtp(verificationId);
      throw new InvalidOrExpiredCode();
    }

    const codeHash = hashOtp(code, this.otpCfg.otpHmacSecret);

    if (!safeEqualHex(codeHash, existingOtp.otpHash)) {
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

      if (authOtpsCount.attemptCount >= maxAttempts) {
        await this.invalidateAuthOtp(verificationId);
        throw new OtpAttemptsExceeded();
      }
      throw new InvalidOrExpiredCode();
    }
    return existingOtp;
  }
}
