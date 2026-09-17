import { UserRole, UserStatus } from '@/generated/prisma/enums';
import { UserSelected } from '../users.select';

export class UserResponseDto implements UserSelected {
  id!: string;
  email!: string;
  role!: UserRole;
  createdAt!: Date;
  status!: UserStatus;
  updatedAt!: Date;
  emailVerifiedAt!: Date;
}
