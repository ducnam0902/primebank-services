import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET as string,
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '10m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
}));
