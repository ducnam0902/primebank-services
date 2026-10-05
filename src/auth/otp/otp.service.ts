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
}
