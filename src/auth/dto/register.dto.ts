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
    message: 'Password must contain at least one letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain at least one number',
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
  @Matches(/^(?:\+84|0)[0-9]{9}$/, {
    message: 'Phone number must be in a valid Vietnamese format',
  })
  phoneNumber!: string;

  @Transform(({ value }) => {
    const input: unknown = value;
    return input === '' || input === null ? undefined : input;
  })
  @IsOptional()
  @IsDateString(
    { strict: true },
    { message: 'Date of birth must be in a valid YYYY-MM-DD format' },
  )
  dateOfBirth!: string;
}
