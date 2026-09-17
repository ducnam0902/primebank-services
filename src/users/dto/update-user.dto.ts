import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { UserRole, UserStatus } from '@/generated/prisma/enums';

export class UpdateUserDto {
  @IsBoolean()
  @IsOptional()
  status?: UserStatus;

  @IsString()
  @IsOptional()
  emailVerifiedAt?: string;

  @IsIn(Object.values(UserRole))
  @IsOptional()
  role?: UserRole;
}
