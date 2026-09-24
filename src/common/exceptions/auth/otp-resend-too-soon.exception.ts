import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class OtpResendTooSoon extends BaseException {
  constructor(retryAfter: number) {
    super(
      ErrorCode.OTP_RESEND_TOO_SOON,
      'Otp ressend too soon',
      HttpStatus.TOO_MANY_REQUESTS,
      {
        retryAfter,
      },
    );
  }
}
