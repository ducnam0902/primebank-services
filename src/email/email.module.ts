import { Module, } from '@nestjs/common';
import { EmailService } from './email.service';
import { ConfigModule } from '@nestjs/config';
import { mailConfig } from '../config';

@Module({
  imports: [ConfigModule.forFeature(mailConfig),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule { }
