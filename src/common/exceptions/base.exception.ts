import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCodeType } from '../constants/error-codes.constant';

export class BaseException extends HttpException {
  constructor(
    public readonly errorCode: ErrorCodeType,
    message: string,
    statusCode: HttpStatus,
    public readonly details?: unknown,
  ) {
    super(
      {
        errorCode,
        message,
        details,
      },
      statusCode,
    );
  }
}
