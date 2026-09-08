import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { databaseConfig } from '../config';
import type { ConfigType } from '@nestjs/config';
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(databaseConfig.KEY)
    private readonly databaseCfg: ConfigType<typeof databaseConfig>
  ) {
    const adapter = new PrismaPg({
      connectionString: databaseCfg.url
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
