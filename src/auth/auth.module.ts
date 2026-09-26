import { Logger, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from '../database/database.module';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { EmailModule } from '../email/email.module';
import { jwtConfig, otpConfig } from '../config';
import { RolesGuard } from './guards/roles.guard';
import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from '@/common/interceptors/transform-response.interceptor';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '@/users/users.module';
import { CustomersModule } from '@/customers/customers.module';
import { OtpServices } from './otp/otp.service';

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
  providers: [
    Logger,
    AuthService,
    JwtStrategy,
    OtpServices,
    { provide: 'APP_FILTER', useClass: AllExceptionsFilter },
    { provide: 'APP_INTERCEPTOR', useClass: TransformResponseInterceptor },
    { provide: 'APP_GUARD', useClass: JwtAuthGuard },
    { provide: 'APP_GUARD', useClass: RolesGuard },
  ],
})
export class AuthModule {}
