import { CustomersModule } from '@/customers/customers.module';
import { UsersModule } from '@/users/users.module';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { jwtConfig, otpConfig } from '../config';
import { DatabaseModule } from '../database/database.module';
import { EmailModule } from '../email/email.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { OtpServices } from './otp/otp.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    DatabaseModule,
    EmailModule,
    UsersModule,
    CustomersModule,
    ConfigModule.forFeature(jwtConfig),
    ConfigModule.forFeature(otpConfig),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule.forFeature(jwtConfig)],
      inject: [jwtConfig.KEY],
      useFactory: (cfg: ConfigType<typeof jwtConfig>) => ({
        secret: cfg.accessSecret,
        signOptions: {
          expiresIn: cfg.accessExpiresIn as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [Logger, AuthService, JwtStrategy, OtpServices],
})
export class AuthModule {}
