import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async nextAccountSequence(tx?: Prisma.TransactionClient): Promise<string> {
    const [row] = await (tx ?? this.prisma).$queryRaw<{ value: string }[]>`
        SELECT nextval('account_number_seq')::text AS value`;
    return row.value;
  }
}
