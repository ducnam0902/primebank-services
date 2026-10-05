import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { OtpPurpose, Prisma, UserStatus } from '../generated/prisma/client';
import { UsersService } from './../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { OtpServices } from './otp/otp.service';
import { generateCifNumber } from './otp/otp.util';

import { buildOtpResponse, generateOtp, hashOtp } from '@/auth/otp/otp.util';
import { EmailAlreadyRegistered } from '@/common/exceptions/auth/email-already-registered.exception';
import { EmailAlreadyVerified } from '@/common/exceptions/auth/email-already-verified.exception';
import { InvalidOrExpiredCode } from '@/common/exceptions/auth/invalid-or-expired-code.exception';
import { NationalIdAlreadyRegistered } from '@/common/exceptions/auth/national-id-already-registered.exception';
import { OtpResendLimitReached } from '@/common/exceptions/auth/otp-resend-limit-reached.exception';
import { OtpResendTooSoon } from '@/common/exceptions/auth/otp-resend-too-soon.exception';
import { PhoneAlreadyRegistered } from '@/common/exceptions/auth/phone-already-registered.exception';
import { getUniqueConstraintFields } from '@/common/utils/prisma-error.util';
import { CustomersService } from '@/customers/customers.service';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig, otpConfig } from '../config';
import { EmailService } from '../email/email.service';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerificationDto } from './dto/verification-response.dto';
import { VerifyEmailResponse } from './dto/verify-email.response.dto';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { EmailPendingVerification } from '@/common/exceptions/auth/email-pending-verification.exception';
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
    const generatedCifNumber = generateCifNumber();
    try {
      const newOtp = generateOtp();
      return await this.prisma.$transaction(async (tx) => {
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
      if (fields.includes('email')) {
        const existedUser = await this.usersService.findByEmail(email);
        if (
          existedUser &&
          existedUser.status === UserStatus.PENDING_VERIFICATION
        ) {
          throw new EmailPendingVerification();
        } else {
          throw new EmailAlreadyRegistered();
        }
      }
      if (fields.includes('phone_number')) throw new PhoneAlreadyRegistered();
      if (fields.includes('national_id'))
        throw new NationalIdAlreadyRegistered();

      this.logger.error('Unmapped unique constraint violation on register', {
        fields,
      });
      throw new InternalServerErrorException(
        'Registration failed, please try again',
      );
    }
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    const { verificationId, code } = dto;
    const existingOtp = await this.otpService.verifyOtp(
      verificationId,
      OtpPurpose.EMAIL_VERIFICATION,
      code,
    );

    if (existingOtp.user.status !== UserStatus.PENDING_VERIFICATION) {
      throw new InvalidOrExpiredCode();
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
        throw new InvalidOrExpiredCode();
      }

      const verifiedUser = await tx.user.updateMany({
        where: {
          id: existingOtp.userId,
          status: UserStatus.PENDING_VERIFICATION,
        },
        data: {
          status: UserStatus.ACTIVE,
        },
      });

      if (verifiedUser.count !== 1) {
        throw new InvalidOrExpiredCode();
      }

      return {
        status: UserStatus.ACTIVE,
      };
    });
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<VerificationDto> {
    const existedOtp = await this.otpService.findById(dto.verificationId);

    if (!existedOtp || existedOtp.purpose !== OtpPurpose.EMAIL_VERIFICATION)
      throw new InvalidOrExpiredCode();

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
}
