import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class OtpResendLimitReached extends BaseException {
  constructor(retryAfter: number) {
    super(
      ErrorCode.OTP_RESEND_LIMIT_REACHED,
      'Otp ressend reached limited',
      HttpStatus.TOO_MANY_REQUESTS,
      {
        retryAfter,
      },
    );
  }
}
