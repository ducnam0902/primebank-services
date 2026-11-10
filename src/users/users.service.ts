import { Prisma, UserStatus } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { UserRepository } from './users.repository';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { PaginatedResult } from '@/common/interfaces/paginated-result.interface';
import { UserSelected, UserAuthSelected, UserProfile } from './users.select';
import {
  buildPaginatedResult,
  getPrismaPagination,
} from '@/common/utils/pagination.util';
import { UserNotFound } from '@/common/exceptions/users/user-not-found.exception';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserData } from './dto/create-user.dto';

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

  async findByEmail(
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<UserSelected | null> {
    const user = await this.usersRepository.findByEmail(email, tx);
    return user;
  }

  async create(
    data: CreateUserData,
    tx?: Prisma.TransactionClient,
  ): Promise<UserSelected> {
    return this.usersRepository.create({ ...data }, tx);
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserSelected> {
    await this.findOne(id);
    return this.usersRepository.update(id, dto);
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserSelected> {
    await this.findOne(id);
    return this.usersRepository.update(id, { status });
  }

  async lockForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ status: UserStatus } | null> {
    return this.usersRepository.lockForUpdate(id, tx);
  }

  async findByEmailForLogin(email: string): Promise<UserAuthSelected | null> {
    return this.usersRepository.findByEmailForLogin(email);
  }

  async findProfile(id: string): Promise<UserProfile> {
    const user = await this.usersRepository.findProfileById(id);
    if (!user) {
      throw new UserNotFound();
    }
    return user;
  }

  async recordFailedLogin(
    userId: string,
    max: number,
    lockMinutes: number,
  ): Promise<{ lockedUntil: Date | null }> {
    const user = await this.usersRepository.update(userId, {
      failedLoginAttempts: { increment: 1 },
    });

    if (user.failedLoginAttempts >= max) {
      const lockedUntil = new Date();
      lockedUntil.setMinutes(lockedUntil.getMinutes() + lockMinutes);
      await this.usersRepository.update(userId, {
        failedLoginAttempts: 0,
        lockedUntil,
      });
      return { lockedUntil };
    }

    return { lockedUntil: null };
  }

  async resetFailedLogins(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      failedLoginAttempts: 0,
      lockedUntil: null,
    });
  }

  async updatePassword(
    userId: string,
    passwordHash: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    await this.usersRepository.update(
      userId,
      { passwordHash, lockedUntil: null, failedLoginAttempts: 0 },
      tx,
    );
  }
}
