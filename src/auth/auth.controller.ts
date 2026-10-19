import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import type { Response } from 'express';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerificationDto } from './dto/verification-response.dto';
import { VerifyEmailResponse } from './dto/verify-email.response.dto';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request.type';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './constants/auth.constants';
import { appConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiOkResponse({ type: VerificationDto })
  @ApiResponse({ status: 409, description: 'Conflict exceptions.' })
  register(@Body() dto: RegisterDto): Promise<VerificationDto> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify email' })
  @ApiOkResponse({ type: VerifyEmailResponse })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Public()
  @ApiOperation({ summary: 'Resend verification otp' })
  @ApiOkResponse({ type: VerificationDto })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<VerificationDto> {
    return this.authService.resendVerification(dto);
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login' })
  @ApiOkResponse({ type: LoginResponseDto })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ): Promise<LoginResponseDto> {
    const token = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, token.refreshToken, token.refreshExpiresAt);
    return { accessToken: token.accessToken };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    console.log('request.user.sub', request.user.sub);
    // return this.authService.getCurrentUser(request.user.sub);
  }

  private setRefreshTokenCookie(
    res: Response,
    token: string,
    expiresAt: Date,
  ): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.appCfg.env === 'production',
      sameSite: 'lax',
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.appCfg.env === 'production',
      sameSite: 'lax',
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  }
}
