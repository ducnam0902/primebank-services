import type { UserRole } from '@/generated/prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
}
