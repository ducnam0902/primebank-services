import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class PhoneAlreadyRegistered extends BaseException {
  constructor() {
    super(
      ErrorCode.PHONE_ALREADY_REGISTERED,
      'Phone number is already registered',
      HttpStatus.CONFLICT,
    );
  }
}
