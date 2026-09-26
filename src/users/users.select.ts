import { Prisma } from '@/generated/prisma/client';

export const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  createdAt: true,
  status: true,
  updatedAt: true,
  failedLoginAttempts: true,
  lockedUntil: true,
} satisfies Prisma.UserSelect;

export const USER_AUTH_SELECT = {
  id: true,
  email: true,
  passwordHash: true,
  role: true,
  createdAt: true,
  status: true,
  failedLoginAttempts: true,
  lockedUntil: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export type UserSelected = Prisma.UserGetPayload<{
  select: typeof USER_SELECT;
}>;
