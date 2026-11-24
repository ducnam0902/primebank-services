import { AccountStatus, AccountType, Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { AccountRepository } from './accounts.repository';
import { withCheckDigit } from './utils/account-number.util';
import { AccountSelected } from './accounts.select';

@Injectable()
export class AccountsService {
  constructor(private readonly accountRepository: AccountRepository) {}

  async openDefaultAccount(
    customerId: string,
    tx: Prisma.TransactionClient,
  ): Promise<AccountSelected> {
    const sequence = await this.accountRepository.nextAccountSequence(tx);
    const accountNumber = withCheckDigit(sequence);
    return this.accountRepository.create(
      {
        type: AccountType.PAYMENT,
        accountNumber,
        customerId,
        currency: 'VND',
        status: AccountStatus.ACTIVE,
        balance: 0,
      },
      tx,
    );
  }
}
