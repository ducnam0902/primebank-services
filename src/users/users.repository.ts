import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { USER_SELECT, UserSelected } from './users.select';

interface FindManyParams {
  where?: Prisma.UserWhereInput;
  orderBy?: Prisma.UserOrderByWithRelationInput;
  skip?: number;
  take?: number;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<UserSelected | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
  }

  findManyAndCount(params: FindManyParams): Promise<[UserSelected[], number]> {
    return this.prisma.$transaction([
      this.prisma.user.findMany({ ...params, select: USER_SELECT }),
      this.prisma.user.count({ where: params.where }),
    ]);
  }

  findByEmail(email: string): Promise<UserSelected | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: USER_SELECT,
    });
  }

  create(
    data: Prisma.UserCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<UserSelected> {
    return (tx ?? this.prisma).user.create({
      data,
      select: USER_SELECT,
    });
  }

  update(
    id: string,
    data: Prisma.UserUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<UserSelected> {
    return (tx ?? this.prisma).user.update({
      where: { id },
      data,
      select: USER_SELECT,
    });
  }
}
