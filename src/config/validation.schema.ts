import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  ALLOWED_ORIGINS: Joi.string().required(),
  FRONTEND_URL: Joi.string().uri().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  JWT_VERIFICATION_SECRET: Joi.string().min(32).required(),
  JWT_VERIFICATION_EXPIRES_IN: Joi.string().default('24h'),
  MAX_ATTEMPTS: Joi.number().default(5),

  MAIL_HOST: Joi.string().required(),
  MAIL_PORT: Joi.number().default(587),
  MAIL_SECURE: Joi.boolean().default(false),
  MAIL_USER: Joi.string().default('Primebank'),
  MAIL_PASSWORD: Joi.string().default('PrimeBank < onboarding@resend.dev >'),
  MAIL_FROM: Joi.string().default('onboarding@resend.dev'),
  MAIL_API_KEY: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),
});
