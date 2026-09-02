import { IsString, Length, Matches } from 'class-validator';
export class VerifyEmailDto {
  @IsString()
  @Length(6, 6)
  @Matches(/[0-9]{6}/, {
    message: 'Mã Code đủ 6 kí tự ',
  })
  code!: string;

  @IsString()
  verificationId!: string;
}
