import { Injectable } from '@nestjs/common';
import { CustomerRepository } from './customers.repository';
import { Prisma } from '@/generated/prisma/client';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomerSelected } from './customers.select';

@Injectable()
export class CustomersService {
  constructor(private readonly customerRepository: CustomerRepository) {}

  async create(
    data: CreateCustomerDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerSelected> {
    return this.customerRepository.create({ ...data }, tx);
  }

  async findByUserId(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerSelected | null> {
    return this.customerRepository.findByUserId(userId, tx);
  }
}
