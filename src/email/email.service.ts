import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface SendVerificationCodeParams {
  email: string;
  code: string;
  verificationId: string;
  expiresInMinutes: number;
}

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(
      this.configService.getOrThrow<string>('RESEND_API_KEY'),
    );

    this.from = this.configService.getOrThrow<string>('EMAIL_FROM');
  }

  async sendVerificationCode({
    email,
    code,
    verificationId,
    expiresInMinutes,
  }: SendVerificationCodeParams): Promise<void> {
    const { error } = await this.resend.emails.send(
      {
        from: this.from,
        to: [email],
        subject: 'PrimeBank verification code',
        text: [
          `Your PrimeBank verification code is: ${code}`,
          `This code expires in ${expiresInMinutes} minutes.`,
          'Do not share this code with anyone.',
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif">
            <h2>Verify your PrimeBank account</h2>

            <p>Your verification code is:</p>

            <p style="
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
            ">
              ${code}
            </p>

            <p>
              This code expires in
              ${expiresInMinutes} minutes.
            </p>

            <p>
              Do not share this code with anyone.
            </p>
          </div>
        `,
      },
      {
        idempotencyKey: `verify-email/${verificationId}`,
      },
    );

    if (error) {
      throw new ServiceUnavailableException(
        'Unable to send verification email',
      );
    }
  }
}
