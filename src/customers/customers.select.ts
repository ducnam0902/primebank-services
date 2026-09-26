import { Prisma } from '@/generated/prisma/client';

export const CUSTOMER_SELECT = {
  id: true,
  userId: true,
  fullName: true,
  phoneNumber: true,
  dateOfBirth: true,
} satisfies Prisma.CustomerSelect;

export type CustomerSelected = Prisma.CustomerGetPayload<{
  select: typeof CUSTOMER_SELECT;
}>;
