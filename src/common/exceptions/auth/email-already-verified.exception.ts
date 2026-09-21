import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class EmailAlreadyVerified extends BaseException {
  constructor() {
    super(
      ErrorCode.EMAIL_ALREADY_VERIFIED,
      'Email had already verified',
      HttpStatus.CONFLICT,
    );
  }
}
