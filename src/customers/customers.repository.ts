import { PrismaService } from '@/database/prisma.service';
import { Prisma } from '@/generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { CustomerSelected, CUSTOMER_SELECT } from './customers.select';

interface FindManyParams {
  where?: Prisma.CustomerWhereInput;
  orderBy?: Prisma.CustomerOrderByWithRelationInput;
  skip?: number;
  take?: number;
}

export interface CreateCustomerData {
  userId: string;
  fullName: string;
  phone: string | null;
  dateOfBirth: Date | null;
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
    data: CreateCustomerData,
    tx?: Prisma.TransactionClient,
  ): Promise<CustomerSelected> {
    return (tx ?? this.prisma).customer.create({
      data,
      select: CUSTOMER_SELECT,
    });
  }
}
