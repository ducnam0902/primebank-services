import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class EmaillSamePassword extends BaseException {
  constructor() {
    super(
      ErrorCode.EMAIL_SAME_PASSWORD,
      'Password must not be the same email',
      HttpStatus.BAD_REQUEST,
    );
  }
}
