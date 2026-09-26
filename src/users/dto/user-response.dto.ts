import { Role, UserStatus } from '@/generated/prisma/enums';
import { UserSelected } from '../users.select';

export class UserResponseDto implements UserSelected {
  id!: string;
  email!: string;
  role!: Role;
  createdAt!: Date;
  status!: UserStatus;
  updatedAt!: Date;
  failedLoginAttempts!: number;
  lockedUntil!: Date;
}
