import {
  Body,
  Controller,
  HttpCode,
  Post,
  HttpStatus,
  Get,
  Req,
  UseGuards,
  Res,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import omit from 'lodash/omit';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedRequest } from './types/authenticated-request.type';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './constants/auth.constants';
import type { CookieRequest } from './types/cookie-request.type';
import { VerifyEmailDto } from './dto/verifyEmail.dto';
import { ResendVerificationDto } from './dto/resendVerification.dto';
import { appConfig } from '../config';
import type { ConfigType } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(appConfig.KEY)
    private readonly appCfg: ConfigType<typeof appConfig>,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);
    this.setRefreshTokenCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
    );
    const responseData = omit(result, [
      'refreshToken',
      'refreshTokenExpiresAt',
    ]);
    return responseData;
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

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const cookieValue = request.cookies[REFRESH_TOKEN_COOKIE];

    if (typeof cookieValue !== 'string') {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refresh(cookieValue);

    this.setRefreshTokenCookie(
      response,
      result.newRefreshToken,
      result.refreshTokenExpiresAt,
    );

    const responseBody = omit(result, [
      'newRefreshToken',
      'refreshTokenExpiresAt',
    ]);

    return responseBody;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies[REFRESH_TOKEN_COOKIE];

    if (typeof refreshToken === 'string') {
      await this.authService.logout(refreshToken);
    }

    this.clearRefreshTokenCookie(response);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }
}
