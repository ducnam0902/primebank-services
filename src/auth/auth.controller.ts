import { ApiSuccessResponse } from '@/common/decorators/api-success-response.decorator';
import { appConfig } from '@/config';
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
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { REFRESH_TOKEN_COOKIE } from './constants/auth.constants';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginResponseDto } from './dto/login-response.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerificationDto } from './dto/verification-response.dto';
import { VerifyEmailResponse } from './dto/verify-email.response.dto';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import type { CookieRequest } from './types/cookie-request.type';
import { InvalidRefreshTokenException } from '@/common/exceptions/auth/invalid-refresh-token.exception';

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

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Current user' })
  @ApiSuccessResponse(MeResponseDto)
  getCurrentUser(@CurrentUser('id') id: string): Promise<MeResponseDto> {
    return this.authService.getCurrentUser(id);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh the session' })
  @ApiOkResponse({ type: LoginResponseDto })
  async refresh(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    try {
      const raw = req.cookies[REFRESH_TOKEN_COOKIE];
      if (typeof raw !== 'string' || raw === '') {
        throw new InvalidRefreshTokenException();
      }

      const token = await this.authService.refresh(raw);
      this.setRefreshTokenCookie(
        res,
        token.refreshToken,
        token.refreshExpiresAt,
      );
      return { accessToken: token.accessToken };
    } catch (e) {
      if (e instanceof InvalidRefreshTokenException) {
        this.clearRefreshTokenCookie(res);
      }
      throw e;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out' })
  async logout(
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      const raw = req.cookies[REFRESH_TOKEN_COOKIE];
      if (typeof raw === 'string' && raw !== '') {
        await this.authService.logout(raw);
      }
    } finally {
      this.clearRefreshTokenCookie(res);
    }
  }

  private getRefreshCookiePath(): string {
    return `${this.appCfg.apiPrefix}/auth`;
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
      path: this.getRefreshCookiePath(),
      expires: expiresAt,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, {
      httpOnly: true,
      secure: this.appCfg.env === 'production',
      sameSite: 'lax',
      path: this.getRefreshCookiePath(),
    });
  }
}
