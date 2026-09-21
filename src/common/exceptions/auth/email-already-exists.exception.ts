import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class EmailAlreadyExists extends BaseException {
  constructor() {
    super(
      ErrorCode.EMAIL_ALREADY_EXISTS,
      'Email had already existed',
      HttpStatus.CONFLICT,
    );
  }
}
