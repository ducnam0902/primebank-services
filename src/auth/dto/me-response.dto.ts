import { Role, UserStatus } from '@/generated/prisma/enums';
import { UserProfile } from '@/users/users.select';

export class MeResponseDto implements UserProfile {
  id!: string;
  email!: string;
  role!: Role;
  status!: UserStatus;
  customer!: CustomerDto | null;
}

export class CustomerDto implements NonNullable<UserProfile['customer']> {
  cifNumber!: string;
  fullName!: string;
  phoneNumber!: string;
  dateOfBirth!: Date;
  address!: string;
}
