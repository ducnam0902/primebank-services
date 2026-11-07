import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  loginMaxFailedAttempts: parseInt(
    process.env.LOGIN_MAX_FAILED_ATTEMPTS || '5',
  ),
  loginLockMinutes: parseInt(process.env.LOGIN_LOCK_MINUTES || '15'),
}));
