import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class UserNotFound extends BaseException {
  constructor() {
    super(
      ErrorCode.USER_NOT_FOUND,
      'Can not find a user',
      HttpStatus.NOT_FOUND,
    );
  }
}
