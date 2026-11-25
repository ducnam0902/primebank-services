import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  ACCOUNT_LOOKUP_SELECT,
  ACCOUNT_SELECT,
  AccountLookupSelected,
  AccountSelected,
} from './accounts.select';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nextAccountSequence(tx?: Prisma.TransactionClient): Promise<string> {
    const [row] = await (tx ?? this.prisma).$queryRaw<{ value: string }[]>`
        SELECT nextval('account_number_seq')::text AS value`;
    return row.value;
  }

  async create(
    data: CreateAccountDto,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountSelected> {
    return (tx ?? this.prisma).account.create({
      data,
      select: ACCOUNT_SELECT,
    });
  }

  async findManyByUserId(userId: string): Promise<AccountSelected[]> {
    return this.prisma.account.findMany({
      where: { customer: { user: { id: userId } } },
      select: ACCOUNT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<AccountSelected | null> {
    return this.prisma.account.findUnique({
      where: { id, customer: { user: { id: userId } } },
      select: ACCOUNT_SELECT,
    });
  }

  async findByAccountNumber(
    accountNumber: string,
  ): Promise<AccountLookupSelected | null> {
    return this.prisma.account.findUnique({
      where: { accountNumber },
      select: ACCOUNT_LOOKUP_SELECT,
    });
  }
}
