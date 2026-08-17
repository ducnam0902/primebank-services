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
} from '@nestjs/common';
import omit from 'lodash/omit';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { AuthenticatedRequest } from './types/authenticated-request.type';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
} from './constants/auth.constants';
import type { CookieRequest } from './types/cookie-request.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
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
      secure: this.configService.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires: expiresAt,
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
}
