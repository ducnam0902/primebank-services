export class VerificationDto {
  verificationId!: string;
  maskedEmail!: string;
  expiresIn!: number;
  resendAfter!: number;
  message!: string;
}
