import { Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { AccountRepository } from './accounts.repository';
import { withCheckDigit } from './utils/account-number.util';

@Injectable()
export class AccountsService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async openDefaultAccount(
    customerId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const sequence = await this.accountRepository.nextAccountSequence(tx);
    const accountNumber = withCheckDigit(sequence);
    console.log(accountNumber);
  }
}
