import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class OtpNotFound extends BaseException {
  constructor() {
    super(ErrorCode.OTP_NOT_FOUND, 'Can not find OTP', HttpStatus.NOT_FOUND);
  }
}
