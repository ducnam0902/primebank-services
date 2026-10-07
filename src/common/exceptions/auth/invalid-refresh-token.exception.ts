import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class InvalidRefreshTokenException extends BaseException {
  constructor() {
    super(
      ErrorCode.INVALID_REFRESH_TOKEN,
      'Refresh token is invalid',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
