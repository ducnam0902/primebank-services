import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class NationalIdAlreadyRegistered extends BaseException {
  constructor() {
    super(
      ErrorCode.NATIONAL_ID_ALREADY_REGISTERED,
      'National ID is already registered',
      HttpStatus.CONFLICT,
    );
  }
}
