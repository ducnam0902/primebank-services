import { Inject, Injectable } from '@nestjs/common';
import { generateOtp, hashOtp } from './otp.util';
import { OtpPurpose } from '@/generated/prisma/enums';
import { Otp } from '@/generated/prisma/client';
import { otpConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { Prisma } from '@/generated/prisma/client';
import { UserSelected } from '@/users/users.select';
import { PrismaService } from '@/database/prisma.service';

interface IIssueVerifyOtp {
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
    const otp = generateOtp();
    const authOtps = await tx.otp.create({
      data: {
        userId: user.id,
        otpHash: hashOtp(otp),
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
}
