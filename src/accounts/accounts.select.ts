import { Prisma } from '@/generated/prisma/client';

export const ACCOUNT_SELECT = {
  id: true,
  accountNumber: true,
  type: true,
  currency: true,
  status: true,
  balance: true,
  createdAt: true,
  updatedAt: true,
  customerId: true,
} satisfies Prisma.AccountSelect;

export type AccountSelected = Prisma.AccountGetPayload<{
  select: typeof ACCOUNT_SELECT;
}>;
