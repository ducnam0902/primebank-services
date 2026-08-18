import {
  ConflictException,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
          },
        });

        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            fullName: dto.fullName,
            phone: dto.phone ?? null,
            dateOfBirth: dto.dateOfBirth
              ? new Date(`${dto.dateOfBirth}T00:00:00.000Z`)
              : null,
          },
        });

        return {
          user,
          customer,
        };
      });

      return {
        message: 'Tài khoản đã được tạo thành công',
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          status: result.user.status,
          customer: {
            id: result.customer.id,
            fullName: result.customer.fullName,
            phone: result.customer.phone,
            dateOfBirth: result.customer.dateOfBirth,
          },
        },
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Số điện thoại hoặc email đã tồn tại');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
      include: {
        customer: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);

    const refreshTokenExpiresAt = this.getRefreshTokenExpiresAt();

    await this.prisma.refreshTokens.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        customer: user.customer
          ? {
              id: user.customer.id,
              fullName: user.customer.fullName,
              phone: user.customer.phone,
              dateOfBirth: user.customer.dateOfBirth,
            }
          : null,
      },
    };
  }

  async getCurrentUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            dateOfBirth: true,
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản của bạn đã bị vô hiệu hóa');
    }

    return user;
  }

  async refresh(rawRefreshToken: string) {
    const currentTokenHash = this.hashRefreshToken(rawRefreshToken);

    const now = new Date();

    const storedToken = await this.prisma.refreshTokens.findUnique({
      where: { tokenHash: currentTokenHash },
      include: { user: true },
    });

    if (
      !storedToken ||
      storedToken.revokedAt !== null ||
      storedToken.expiresAt <= now ||
      storedToken.user.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const newRefreshToken = this.generateRefreshToken();
    const newTokenHash = this.hashRefreshToken(newRefreshToken);

    const payload = {
      sub: storedToken.user.id,
      email: storedToken.user.email,
      role: storedToken.user.role,
    };
    const newAccessToken = await this.jwtService.signAsync(payload);

    const rotationResult = await this.prisma.refreshTokens.updateMany({
      where: {
        id: storedToken.id,
        tokenHash: currentTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        tokenHash: newTokenHash,
        lastUsedAt: now,
      },
    });

    if (rotationResult.count !== 1) {
      throw new UnauthorizedException('Failed to refresh token');
    }

    return {
      accessToken: newAccessToken,
      expiresAt: this.getAccessTokenTtlSeconds(),

      newRefreshToken,
      refreshTokenExpiresAt: storedToken.expiresAt, // Keep the original expiration date for the new token
    };
  }

  private generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiresAt(): Date {
    const ttlDays =
      Number(this.configService.get('REFRESH_TOKEN_TTL_DAYS')) || 7;

    if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
      throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive number');
    }

    return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000); // Convert days to milliseconds
  }

  private getAccessTokenTtlSeconds(): number {
    return Number(this.configService.get('JWT_ACCESS_TTL_SECONDS')) || 900; // Default to 15 minutes
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    await this.prisma.refreshTokens.updateMany({
      where: {
        tokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }
}
