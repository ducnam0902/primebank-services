import { Prisma, UserStatus } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { UserRepository } from './users.repository';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { PaginatedResult } from '@/common/interfaces/paginated-result.interface';
import { UserSelected } from './users.select';
import {
  buildPaginatedResult,
  getPrismaPagination,
} from '@/common/utils/pagination.util';
import { UserNotFound } from '@/common/exceptions/users/user-not-found.exception';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UserRepository) {}

  async findAll(
    query: FindUsersQueryDto,
  ): Promise<PaginatedResult<UserSelected>> {
    const { skip, take } = getPrismaPagination(query);

    const [data, total] = await this.usersRepository.findManyAndCount({
      where: this.buildWhere(query),
      orderBy: { [query.sortBy ?? 'createdAt']: query.sortOrder },
      skip,
      take,
    });

    return buildPaginatedResult(data, query, total);
  }

  private buildWhere(query: FindUsersQueryDto): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (query.search) {
      where.OR = [{ email: { contains: query.search, mode: 'insensitive' } }];
    }
    if (query.role) where.role = query.role;

    return where;
  }

  async findOne(id: string): Promise<UserSelected> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new UserNotFound();
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserSelected> {
    await this.findOne(id);
    return this.usersRepository.update(id, dto);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserSelected> {
    await this.findOne(id);
    return this.usersRepository.update(id, { status });
  }
}
