import { AccountStatus, AccountType } from '@/generated/prisma/enums';
import { AccountSelected } from '../accounts.select';

export class AccountResponseDto implements Omit<
  AccountSelected,
  'balance' | 'customerId' | 'updatedAt'
> {
  id!: string;
  accountNumber!: string;
  type!: AccountType;
  currency!: string;
  status!: AccountStatus;
  balance!: string;
  createdAt!: Date;
}
