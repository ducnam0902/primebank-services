import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class InvalidOrExpiredCode extends BaseException {
  constructor() {
    super(
      ErrorCode.INVALID_OR_EXPIRED_CODE,
      'Invalid or expired code',
      HttpStatus.BAD_REQUEST,
    );
  }
}
