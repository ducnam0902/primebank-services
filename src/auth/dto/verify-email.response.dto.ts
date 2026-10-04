import { UserStatus } from '@/generated/prisma/enums';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailResponse {
  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;
}
