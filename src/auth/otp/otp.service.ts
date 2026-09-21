import { Inject, Injectable } from '@nestjs/common';
import { generateOtp, hashOtp } from './otp.util';
import { Purpose } from '@/generated/prisma/enums';
import { AuthOtps } from '@/generated/prisma/client';
import { otpConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { UserSelected } from '@/users/users.select';

interface IIssueVerifyOtp {
  otp: string;
  authOtps: AuthOtps;
  email: string;
}

@Injectable()
export class OtpServices {
  constructor(
    @Inject(otpConfig.KEY)
    private readonly otpCfg: ConfigType<typeof otpConfig>,
  ) {}

  async issueVerifyOtp(
    user: UserSelected,
    tx: Prisma.TransactionClient,
  ): Promise<IIssueVerifyOtp> {
    await tx.authOtps.updateMany({
      where: {
        userId: user.id,
        purpose: Purpose.VERIFY_EMAIL,
        invalidatedAt: null,
      },
      data: {
        invalidatedAt: new Date(),
      },
    });
    const otp = generateOtp();
    const authOtps = await tx.authOtps.create({
      data: {
        userId: user.id,
        otpHash: hashOtp(otp),
        purpose: Purpose.VERIFY_EMAIL,
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
}
