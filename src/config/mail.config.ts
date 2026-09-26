import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  from: process.env.MAIL_FROM,
  apiKey: process.env.MAIL_API_KEY,
}));
