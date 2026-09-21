export class RegisterResponseDto {
  verificationId!: string;
  maskedEmail!: string;
  expiresIn!: number;
  resendAfter!: number;
  message!: string;
}
