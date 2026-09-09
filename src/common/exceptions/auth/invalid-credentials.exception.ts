import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '../../constants/error-codes.constant';

export class InvalidCredentialsException extends BaseException {
  constructor() {
    super(
      ErrorCode.INVALID_CREDENTIALS,
      'Email or password is invalid',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
