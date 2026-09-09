import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { SKIP_TRANSFORM_KEY } from '../decorators/skip-transform.decorator';

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

    return next.handle().pipe(
      map((payload) => {
        const isPaginated: boolean  =
          payload &&
          typeof payload === 'object' &&
          'data' in payload &&
          'meta' in payload;
        return {
          success: true,
          statusCode: response.status,
          data: isPaginated ? payload.data : payload,
          ...(isPaginated ? { meta: payload.meta } : {}),
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
