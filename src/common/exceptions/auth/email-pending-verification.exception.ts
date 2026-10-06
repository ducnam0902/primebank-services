import { HttpStatus } from '@nestjs/common';
import { BaseException } from '../base.exception';
import { ErrorCode } from '@/common/constants/error-codes.constant';

export class EmailPendingVerification extends BaseException {
  constructor(verificationId: string | null) {
    super(
      ErrorCode.EMAIL_PENDING_VERIFICATION,
      'Email is pending verification',
      HttpStatus.CONFLICT,
      {
        verificationId,
      },
    );
  }
}
