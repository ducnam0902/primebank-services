import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class AccountLockedException extends BaseException {
  constructor() {
    super(ErrorCode.ACCOUNT_LOCKED, 'Account Locked', HttpStatus.LOCKED);
  }
}
