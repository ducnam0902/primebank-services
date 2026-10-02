import { IsMinAge } from '@/common/decorators/is-min-age.decorator';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsString,
  Length,
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
  @MinLength(1)
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

  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Date of birth must be in a valid YYYY-MM-DD format',
  })
  @IsDateString(
    { strict: true },
    { message: 'Date of birth must be in a valid YYYY-MM-DD format' },
  )
  @IsMinAge(18, { message: 'You must be at least 18 years old' })
  dateOfBirth!: string;

  @IsString()
  @Matches(/^\d{12}$/, {
    message: 'National id must be in a valid Vietnamese format',
  })
  nationalId!: string;

  @IsString()
  @Transform(({ value }) => {
    const input: unknown = value;
    return typeof input === 'string' ? input.trim() : input;
  })
  @Length(1, 255)
  address!: string;
}
