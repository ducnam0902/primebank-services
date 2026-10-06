import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
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
  constructor(private readonly authService: AuthService) {}

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

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    console.log('request.user.sub', request.user.sub);
    // return this.authService.getCurrentUser(request.user.sub);
  }
}
