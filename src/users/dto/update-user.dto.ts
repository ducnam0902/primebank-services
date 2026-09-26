import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { Role, UserStatus } from '@/generated/prisma/enums';

export class UpdateUserDto {
  @IsBoolean()
  @IsOptional()
  status?: UserStatus;

  @IsString()
  @IsOptional()
  emailVerifiedAt?: string;

  @IsIn(Object.values(Role))
  @IsOptional()
  role?: Role;
}
