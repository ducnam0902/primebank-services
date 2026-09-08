import type { Request } from 'express';

export type CookieRequest = Omit<Request, 'cookies'> & {
  cookies: Record<string, unknown>;
};
