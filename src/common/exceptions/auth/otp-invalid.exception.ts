import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class OtpInvalid extends BaseException {
  constructor(attemptsLeft: number) {
    super(ErrorCode.OTP_INVALID, 'Invalid OTP', HttpStatus.BAD_REQUEST, {
      attemptsLeft,
    });
  }
}
