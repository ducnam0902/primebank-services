import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class EmailAlreadyRegistered extends BaseException {
  constructor() {
    super(
      ErrorCode.EMAIL_ALREADY_REGISTERED,
      'Email is already registered',
      HttpStatus.CONFLICT,
    );
  }
}
