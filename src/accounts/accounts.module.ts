import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountRepository } from './accounts.repository';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountRepository],
  exports: [AccountsService],
})
export class AccountsModule {}
