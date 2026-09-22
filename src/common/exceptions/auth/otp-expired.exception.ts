import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export enum OtpReason {
  CONSUMED,
  SUPERSEDED,
  EXPIRED,
}

export class OtpExpired extends BaseException {
  constructor(reason: OtpReason) {
    super(ErrorCode.OTP_EXPIRED, 'OTP Expired', HttpStatus.UNAUTHORIZED, {
      reason,
    });
  }
}
