import { registerAs } from '@nestjs/config';

export default registerAs('otp', () => ({
  //OTP time to live
  otpTtlSeconds: Number(process.env.OTP_TTL_SECONDS) || 300,
  //Time between 2 times send OTP
  otpResendCooldownSeconds:
    Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
  otpMaxIssuesPerHour: Number(process.env.OTP_MAX_ISSUES_PER_HOUR) || 5,
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
}));
