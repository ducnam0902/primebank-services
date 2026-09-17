import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { UserRole } from '@/generated/prisma/enums';

export class FindUsersQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsIn(Object.values(UserRole))
  @IsOptional()
  role?: UserRole;

  @IsIn(['createdAt', 'email', 'status'])
  @IsOptional()
  declare sortBy?: string;
}
