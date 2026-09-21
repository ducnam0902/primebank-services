import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomerRepository } from './customers.repository';

@Module({
  providers: [CustomersService, CustomerRepository],
  controllers: [CustomersController],
  exports: [CustomersService],
})
export class CustomersModule {}
