import { IsString, IsUUID, Length, Matches } from 'class-validator';
export class VerifyEmailDto {
  @IsString()
  @Length(6, 6)
  @Matches(/[0-9]{6}/, {
    message: 'Mã Code đủ 6 kí tự ',
  })
  code!: string;

  @IsString()
  @IsUUID('4')
  verificationId!: string;
}
