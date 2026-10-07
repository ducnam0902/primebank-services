import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '10m',
  refreshTTLDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS),
}));
