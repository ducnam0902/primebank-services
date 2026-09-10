import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { databaseConfig } from '../config';
import { ConfigModule } from '@nestjs/config';

@Global()
@Module({
  imports: [ConfigModule.forFeature(databaseConfig)],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
