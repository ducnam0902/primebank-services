import { registerAs } from '@nestjs/config';

export default registerAs('throttle', () => ({
  ttl: Number(process.env.THROTTLE_TTL) || 60_000,
  limit: Number(process.env.THROTTLE_LIMIT) || 60,
  authLimit: Number(process.env.THROTTLE_AUTH_LIMIT) || 5,
  verificationCooldownMs:
    Number(process.env.VERIFICATION_COOLDOWN_MS) || 60_000,
  verificationMaxPerDay: Number(process.env.VERIFICATION_MAX_PER_DAY) || 5,
  maxAttempts: Number(process.env.MAX_ATTEMPTS) || 5,
}));
