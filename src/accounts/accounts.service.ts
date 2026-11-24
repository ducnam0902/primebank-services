import { AccountStatus, AccountType, Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { AccountRepository } from './accounts.repository';
import { withCheckDigit } from './utils/account-number.util';
import { AccountSelected } from './accounts.select';
import { AccountResponseDto } from './dto/account-response.dto';
import { AccountNotFound } from '@/common/exceptions/account/account-not-found.exception';
import { toAccountResponse } from './utils/accounts.mapper';

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

  async getAllCustomerAccounts(userId: string): Promise<AccountResponseDto[]> {
    const accountList = await this.accountRepository.findManyByUserId(userId);
    return accountList.map((item) => toAccountResponse(item));
  }

  async getCustomerAccountById(
    id: string,
    userId: string,
  ): Promise<AccountResponseDto> {
    const account = await this.accountRepository.findByIdForUser(id, userId);
    if (!account) {
      throw new AccountNotFound();
    }

    return toAccountResponse(account);
  }
}
