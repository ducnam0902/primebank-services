import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../database/prisma.service';
import { OtpPurpose, Prisma, UserStatus } from '../generated/prisma/client';
import { UsersService } from './../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { IssueOtpResult, OtpServices } from './otp/otp.service';
import { generateCifNumber } from './otp/otp.util';

import { buildOtpResponse } from '@/auth/otp/otp.util';
import { AccountLockedException } from '@/common/exceptions/auth/account-locked.exception';
import { EmailAlreadyRegistered } from '@/common/exceptions/auth/email-already-registered.exception';
import { EmailAlreadyVerified } from '@/common/exceptions/auth/email-already-verified.exception';
import { EmailNotVerified } from '@/common/exceptions/auth/email-not-verified.exception';
import { EmailPendingVerification } from '@/common/exceptions/auth/email-pending-verification.exception';
import { InvalidCredentialsException } from '@/common/exceptions/auth/invalid-credentials.exception';
import { NationalIdAlreadyRegistered } from '@/common/exceptions/auth/national-id-already-registered.exception';
import { PhoneAlreadyRegistered } from '@/common/exceptions/auth/phone-already-registered.exception';
import { InvalidOrExpiredCode } from '@/common/exceptions/otp/invalid-or-expired-code.exception';
import { OtpResendLimitReached } from '@/common/exceptions/otp/otp-resend-limit-reached.exception';
import { OtpResendTooSoon } from '@/common/exceptions/otp/otp-resend-too-soon.exception';
import { assertNever } from '@/common/utils/assert-never.util';
import { getUniqueConstraintFields } from '@/common/utils/prisma-error.util';
import { CustomersService } from '@/customers/customers.service';
import type { ConfigType } from '@nestjs/config';
import { otpConfig } from '../config';
import { EmailService } from '../email/email.service';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerificationDto } from './dto/verification-response.dto';
import { VerifyEmailResponse } from './dto/verify-email.response.dto';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { IssuedTokens, TokenService } from './token/token.service';
@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(otpConfig.KEY)
    private readonly otpCfg: ConfigType<typeof otpConfig>,

    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
    private readonly customerService: CustomersService,
    private readonly tokenService: TokenService,

    private readonly otpService: OtpServices,
    private readonly logger: Logger,
  ) {}

  private dummyHash!: string;

  async onModuleInit(): Promise<void> {
    this.dummyHash = await argon2.hash('timing-equaliser', {
      type: argon2.argon2id,
    });
  }

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
        email,
        code: result.code,
        verificationId: result.otp.id,
        expiresInMinutes: Math.ceil(this.otpCfg.otpTtlSeconds / 60),
      });
    } catch (error) {
      this.logger.error('Send email verification failed', {
        userId: result.otp.userId,
        verificationId: result.otp.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return buildOtpResponse(
      result.otp,
      email,
      this.otpCfg.otpResendCooldownSeconds,
    );
  }

  private async createCustomerAndIssueOtp(
    email: string,
    passwordHash: string,
    dto: RegisterDto,
  ): Promise<Extract<IssueOtpResult, { issued: true }>> {
    const generatedCifNumber = generateCifNumber();
    try {
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

        const result = await this.otpService.issue(
          user.id,
          OtpPurpose.EMAIL_VERIFICATION,
          tx,
        );
        if (!result.issued)
          throw new InternalServerErrorException('Failed to issue OTP');
        return result;
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
          const verificationId = await this.otpService.findLatestId(
            existedUser.id,
            OtpPurpose.EMAIL_VERIFICATION,
          );
          throw new EmailPendingVerification(verificationId);
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

    const result = await this.prisma.$transaction(async (tx) => {
      const locked = await this.usersService.lockForUpdate(
        existedOtp.userId,
        tx,
      );
      if (locked?.status === UserStatus.ACTIVE)
        throw new EmailAlreadyVerified();
      if (locked?.status !== UserStatus.PENDING_VERIFICATION)
        throw new InvalidOrExpiredCode();
      return this.otpService.issue(
        existedOtp.userId,
        OtpPurpose.EMAIL_VERIFICATION,
        tx,
      );
    });

    if (!result.issued) {
      switch (result.reason) {
        case 'COOLDOWN':
          throw new OtpResendTooSoon(result.retryAfterSeconds);
        case 'HOURLY_LIMIT':
          throw new OtpResendLimitReached(result.retryAfterSeconds);
        default:
          return assertNever(result.reason);
      }
    }

    try {
      await this.emailService.sendVerificationCode({
        email: existedOtp.user.email,
        code: result.code,
        verificationId: result.otp.id,
        expiresInMinutes: Math.ceil(this.otpCfg.otpTtlSeconds / 60),
      });
    } catch (error) {
      this.logger.error('Send email verification failed', {
        userId: existedOtp.userId,
        verificationId: result.otp.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return buildOtpResponse(
      result.otp,
      existedOtp.user.email,
      this.otpCfg.otpResendCooldownSeconds,
    );
  }

  async login(dto: LoginDto): Promise<IssuedTokens> {
    const existedUser = await this.usersService.findByEmailForLogin(dto.email);
    if (!existedUser) {
      await argon2.verify(this.dummyHash, dto.password);
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await argon2.verify(
      existedUser.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    if (existedUser.status === UserStatus.PENDING_VERIFICATION) {
      const latestId = await this.otpService.findLatestId(
        existedUser.id,
        OtpPurpose.EMAIL_VERIFICATION,
      );
      throw new EmailNotVerified(latestId);
    }

    if (existedUser.status === UserStatus.LOCKED) {
      throw new AccountLockedException();
    }

    return this.tokenService.issue({
      id: existedUser.id,
      email: existedUser.email,
      role: existedUser.role,
    });
  }

  async getCurrentUser(id: string): Promise<MeResponseDto> {
    return this.usersService.findProfile(id);
  }

  refresh(rawRefreshToken: string): Promise<IssuedTokens> {
    return this.tokenService.rotate(rawRefreshToken);
  }
}
