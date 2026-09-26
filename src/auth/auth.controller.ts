import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { appConfig } from '../config';
import { AuthService } from './auth.service';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './constants/auth.constants';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerificationDto } from './dto/verification-response.dto';
import { VerifyEmailResponse } from './dto/verify-email.response.dto';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedRequest } from './types/authenticated-request.type';

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
  @ApiBody({ type: [RegisterDto] })
  @ApiOkResponse({ type: VerificationDto })
  @ApiResponse({ status: 409, description: 'Conflict exceptions.' })
  register(@Body() dto: RegisterDto): Promise<VerificationDto> {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @Public()
  @ApiOperation({ summary: 'Verify email' })
  @ApiOkResponse({ type: VerifyEmailResponse })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Public()
  @ApiOperation({ summary: 'Resend verification otp' })
  @ApiOkResponse({ type: VerificationDto })
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  async resendVerification(
    @Body() dto: ResendVerificationDto,
  ): Promise<VerificationDto> {
    return this.authService.resendVerification(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.sub);
  }

  private setRefreshTokenCookie(
    response: Response,
    token: string,
    expiresAt: Date,
  ): void {
    response.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.appCfg.env === 'production',
      sameSite: 'lax',
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  private clearRefreshTokenCookie(response: Response): void {
    response.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.appCfg.env === 'production',
      sameSite: 'lax',
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
  }
}
