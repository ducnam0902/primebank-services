import {
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsUUID(4)
  verificationId!: string;

  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit number' })
  code!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Za-z]/, {
    message: 'Password must contain at least one letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number',
  })
  newPassword!: string;
}
