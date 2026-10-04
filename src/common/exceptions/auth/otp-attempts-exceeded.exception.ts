import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class OtpAttemptsExceeded extends BaseException {
  constructor() {
    super(
      ErrorCode.OTP_ATTEMPTS_EXCEEDED,
      'Too many failed OTP attempts',
      HttpStatus.BAD_REQUEST,
    );
  }
}
