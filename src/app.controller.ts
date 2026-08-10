import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './database/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('/health/database')
  async getHealth(): Promise<object> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      service: 'primebank-service',
      timestamp: new Date().toISOString(),
    };
  }
}
