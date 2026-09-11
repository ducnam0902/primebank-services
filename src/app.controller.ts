import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './database/prisma.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('/health/database')
  @Public()
  async getHealth(): Promise<object> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      service: 'primebank-service',
      timestamp: new Date().toISOString(),
    };
  }
}
