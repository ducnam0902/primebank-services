import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class OtpTooManyAttempts extends BaseException {
  constructor() {
    super(
      ErrorCode.OTP_TOO_MANY_ATTEMPTS,
      'Too many attempts',
      HttpStatus.CONFLICT,
    );
  }
}
