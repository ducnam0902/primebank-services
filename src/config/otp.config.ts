import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  //OTP time to live
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS) || 300,
  //Time between 2 times send OTP
  otpResendCooldownSeconds:
    Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
}));
