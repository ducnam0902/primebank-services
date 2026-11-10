import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class EmailSamePasswordException extends BaseException {
  constructor() {
    super(
      ErrorCode.EMAIL_SAME_PASSWORD,
      'New password cannot be the same as the current password',
      HttpStatus.BAD_REQUEST,
    );
  }
}
