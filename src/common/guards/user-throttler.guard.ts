import { AuthenticatedUser } from '@/auth/types/jwt-payload.type';
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: {
    user?: AuthenticatedUser;
    ip?: string;
  }): Promise<string> {
    return Promise.resolve(req.user?.id ?? req.ip ?? '');
  }
}
