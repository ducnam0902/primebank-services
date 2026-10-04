import { IsUUID, Matches } from 'class-validator';
export class VerifyEmailDto {
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  code!: string;

  @IsUUID('4')
  verificationId!: string;
}
