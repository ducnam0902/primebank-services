import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, map } from 'rxjs';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

interface PaginatedPayload {
  data: unknown;
  meta: unknown;
}

function isPaginated(p: unknown): p is PaginatedPayload {
  return typeof p === 'object' && p !== null && 'data' in p && 'meta' in p;
}

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<
  T,
  any
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TRANSFORM_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const response = context.switchToHttp().getResponse<Response>();
    const statusCode = response.statusCode;
    return next.handle().pipe(
      map((payload: unknown) => {
        const paginated = isPaginated(payload);
        return {
          success: true,
          statusCode: statusCode,
          data: paginated ? payload.data : payload,
          ...(paginated ? { meta: payload.meta } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
