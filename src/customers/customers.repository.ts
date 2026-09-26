import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { CustomerSelected, CUSTOMER_SELECT } from './customers.select';
import { CreateCustomerDto } from './dto/create-customer.dto';

interface FindManyParams {
  where?: Prisma.CustomerWhereInput;
  orderBy?: Prisma.CustomerOrderByWithRelationInput;
  skip?: number;
  take?: number;
}

@Injectable()
export class CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CustomerSelected | null> {
    return this.prisma.customer.findUnique({
      where: { id },
      select: CUSTOMER_SELECT,
    });
  }

  findManyAndCount(
    params: FindManyParams,
  ): Promise<[CustomerSelected[], number]> {
    return this.prisma.$transaction([
      this.prisma.customer.findMany({ ...params, select: CUSTOMER_SELECT }),
      this.prisma.customer.count({ where: params.where }),
    ]);
  }

  create(
    data: CreateCustomerDto,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerSelected> {
    return (tx ?? this.prisma).customer.create({
      data,
      select: CUSTOMER_SELECT,
    });
  }
}
