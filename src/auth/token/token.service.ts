import { Prisma } from '@/generated/prisma/client';
import { Role, UserStatus } from '@/generated/prisma/enums';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../types/jwt-payload.type';
import { PrismaService } from '@/database/prisma.service';
import { jwtConfig } from '@/config';
import type { ConfigType } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { InvalidRefreshTokenException } from '@/common/exceptions/auth/invalid-refresh-token.exception';
import { USER_SELECT } from '@/users/users.select';
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class OtpServices {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
  ) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async issue(
    user: { id: string; email: string; role: Role },
    sessionExpiresAt?: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<IssuedTokens> {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      type: 'access',
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshExpiresAt =
      sessionExpiresAt ??
      new Date(Date.now() + this.jwtCfg.refreshTTLDays * DAY_MS);

    const refreshToken = randomBytes(48).toString('base64url');

    await (tx ?? this.prisma).refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
      },
    });
    return {
      refreshToken,
      accessToken,
      refreshExpiresAt,
    };
  }

  async rotate(rawRefreshToken: string): Promise<IssuedTokens> {
    const record = await this.prisma.refreshToken.findUnique({
      where: {
        tokenHash: this.hashToken(rawRefreshToken),
      },
      select: {
        usedAt: true,
        expiresAt: true,
        userId: true,
        id: true,
        user: {
          select: USER_SELECT,
        },
      },
    });

    if (!record || record.expiresAt.getTime() <= Date.now()) {
      throw new InvalidRefreshTokenException();
    }

    if (record.usedAt) {
      await this.revokeAllForUser(record.userId);
      throw new InvalidRefreshTokenException();
    }

    if (record.user.status !== UserStatus.ACTIVE) {
      throw new InvalidRefreshTokenException();
    }

    const tokens = await this.prisma.$transaction(async (tx) => {
      const invalidatedToken = await tx.refreshToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      if (invalidatedToken.count === 1) {
        return this.issue(
          {
            id: record.userId,
            email: record.user.email,
            role: record.user.role,
          },
          record.expiresAt,
          tx,
        );
      }

      return null;
    });

    if (!tokens) {
      await this.revokeAllForUser(record.userId);
      throw new InvalidRefreshTokenException();
    }

    return tokens;
  }

  async revoke(rawRefreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: this.hashToken(rawRefreshToken),
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }

  async revokeAllForUser(
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).refreshToken.updateMany({
      where: {
        userId,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    });
  }
}
