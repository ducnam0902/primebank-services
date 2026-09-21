import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS) || 60,
  otpResendCooldownSeconds:
    Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
}));
