import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().default('api'),
  ALLOWED_ORIGINS: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),

  MAIL_FROM: Joi.string().default('onboarding@resend.dev'),
  MAIL_API_KEY: Joi.string().required(),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  OTP_TTL_SECONDS: Joi.number().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: Joi.number().less(Joi.ref('OTP_TTL_SECONDS')),
  OTP_MAX_ISSUES_PER_HOUR: Joi.number().default(5),
});
