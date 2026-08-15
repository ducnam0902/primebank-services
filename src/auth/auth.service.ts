import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
          },
        });

        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            fullName: dto.fullName,
            phone: dto.phone ?? null,
            dateOfBirth: dto.dateOfBirth
              ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
              : null,
          },
        });

        return {
          user,
          customer,
        };
      });

      return {
        message: 'Tài khoản đã được tạo thành công',
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          status: result.user.status,
          customer: {
            id: result.customer.id,
            fullName: result.customer.fullName,
            phone: result.customer.phone,
            dateOfBirth: result.customer.dateOfBirth,
          },
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Số điện thoại hoặc email đã tồn tại');
      }

      throw error;
    }
  }
}
