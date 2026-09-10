import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,
  apiPrefix: process.env.API_PREFIX || '/api',
  allowedOrigins:
    process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()) ?? [],
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
}));
