import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { Role } from '@/generated/prisma/enums';

export class FindUsersQueryDto extends PaginationQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsIn(Object.values(Role))
  @IsOptional()
  role?: Role;

  @IsIn(['createdAt', 'email', 'status'])
  @IsOptional()
  declare sortBy?: string;
}
