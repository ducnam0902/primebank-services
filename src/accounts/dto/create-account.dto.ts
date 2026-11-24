import { AccountStatus, AccountType } from '@/generated/prisma/enums';

export interface CreateAccountDto {
  type: AccountType;
  accountNumber: string;
  currency: string;
  status: AccountStatus;
  balance: number;
  customerId: string;
}
