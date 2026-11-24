import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class AccountNotFound extends BaseException {
  constructor() {
    super(
      ErrorCode.ACCOUNT_NOT_FOUND,
      'Account not found',
      HttpStatus.NOT_FOUND,
    );
  }
}
