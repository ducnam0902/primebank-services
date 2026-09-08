import { JwtPayload } from './jwt-payload.type';
import type { Request } from 'express';

export type AuthenticatedRequest = Request & {
  user: JwtPayload;
};
