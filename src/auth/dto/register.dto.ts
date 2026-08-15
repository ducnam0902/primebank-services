import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @Transform(({ value }) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim().toLowerCase() : input;
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[A-Za-z]/, {
    message: 'Mật khẩu cần chứa ít một chữ cái',
  })
  @Matches(/[0-9]/, {
    message: 'Mật khẩu cần chứa ít một chữ số',
  })
  password!: string;

  @Transform(({ value }) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim() : input;
  })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @Transform(({ value }) => {
    const input: unknown = value;
    if (input === '' || input === null) {
      return undefined;
    }

    return typeof input === 'string' ? input.trim() : input;
  })
  @IsOptional()
  @Matches(/^(?:\+84|0)[0-9]{9}$/, {
    message: 'Số điện thoại phải là một số điện thoại Việt Nam hợp lệ',
  })
  phone?: string;

  @Transform(({ value }) => {
    const input: unknown = value;
    return input === '' || input === null ? undefined : input;
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Ngày sinh phải theo định dạng YYYY-MM-DD' },
  )
  dateOfBirth?: string;
}
