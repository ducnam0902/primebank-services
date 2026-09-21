import { AuthOtps } from '@/generated/prisma/client';
import { createHash } from 'node:crypto';
import { RegisterResponseDto } from '../dto/register-response.dto';
import repeat from 'lodash/repeat';
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex');
}

export function buildOtpResponse(
  record: AuthOtps,
  email: string,
  resendAfter: number,
): RegisterResponseDto {
  return {
    message: 'OTP sent successfully',
    verificationId: record.id,
    maskedEmail: maskEmail(email),
    expiresIn: Math.max(
      0,
      Math.floor((record.expiresAt.getTime() - Date.now()) / 1000),
    ),
    resendAfter,
  };
}

const maskEmail: (email: string) => string = (email: string) =>
  email.replace(/(.{2})(.*)(?=@)/, (_, visible: string, hidden: string) =>
    visible.concat(repeat('*', hidden.length)),
  );
