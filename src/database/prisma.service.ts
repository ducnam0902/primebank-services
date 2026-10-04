import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { appConfig, databaseConfig } from '../config';
import type { ConfigType } from '@nestjs/config';
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  constructor(
    @Inject(databaseConfig.KEY)
    private readonly databaseCfg: ConfigType<typeof databaseConfig>,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {
    const adapter = new PrismaPg({
      connectionString: databaseCfg.url,
      max: 10, // pool size
      connectionTimeoutMillis: 5_000, // fail clearly instead of hanging forever
      idleTimeoutMillis: 30_000, // keep warm connections longer (pg default is 10s)
    });

    super({
      adapter,
      transactionOptions: {
        maxWait: 5_000, // time allowed to acquire a connection + BEGIN (default 2s)
        timeout: 10_000, // max transaction duration (default 5s)
      },
      log:
        appCfg.env === 'development'
          ? ['query', 'warn', 'error']
          : ['warn', 'error'],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
