import { IsUUID } from 'class-validator';

export class ResendVerificationDto {
  @IsUUID(4)
  verificationId!: string;
}
