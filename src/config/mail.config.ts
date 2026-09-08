import { registerAs } from "@nestjs/config";

export default registerAs("mail", () => ({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: process.env.MAIL_SECURE === 'true',
    user: process.env.MAIL_USER,
    password: process.env.MAIL_PASSWORD,
    from: process.env.MAIL_FROM,
    apiKey: process.env.MAIL_API_KEY,
}));