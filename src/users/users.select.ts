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

export type UserAuthSelected = Prisma.UserGetPayload<{
  select: typeof USER_AUTH_SELECT;
}>;

export const USER_PROFILE_SELECT = {
  id: true,
  email: true,
  role: true,
  status: true,
  customer: {
    select: {
      cifNumber: true,
      fullName: true,
      phoneNumber: true,
      dateOfBirth: true,
      address: true,
    },
  },
} satisfies Prisma.UserSelect;

export type UserProfile = Prisma.UserGetPayload<{
  select: typeof USER_PROFILE_SELECT;
}>;
