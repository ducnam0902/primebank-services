import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/error-response.interface';
import { ErrorCode } from '../constants/error-codes.constant';
import {
  isPrismaKnownError,
  PrismaKnownError,
} from '../utils/prisma-error.util';

export interface ParsedException {
  statusCode: number;
  message: string;
  errorCode: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message, errorCode, details } = this.parse(exception);

    const body: ErrorResponse = {
      success: false,
      statusCode,
      message,
      errorCode,
      details,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    this.log(exception, body, request);
    response.status(statusCode).json(body);
  }

  private parse(exception: unknown): ParsedException {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;

        if (Array.isArray(r.message)) {
          return {
            statusCode: status,
            errorCode: ErrorCode.VALIDATION_FAILED,
            message: 'Data validation failed',
            details: r.message,
          };
        }

        return {
          statusCode: status,
          errorCode:
            typeof r.errorCode === 'string'
              ? r.errorCode
              : this.mapHttpStatus(status),
          message:
            typeof r.message === 'string'
              ? r.message
              : exception.message || 'An error occurred',
          details: r.details,
        };
      }

      return {
        statusCode: status,
        errorCode: this.mapHttpStatus(status),
        message: typeof res === 'string' ? res : exception.message,
        details: undefined,
      };
    }

    if (isPrismaKnownError(exception)) {
      return this.parsePrisma(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: undefined,
    };
  }

  private parsePrisma(e: PrismaKnownError): ParsedException {
    switch (e.code) {
      case 'P2002': // unique constraint
        return {
          statusCode: HttpStatus.CONFLICT,
          errorCode: ErrorCode.EMAIL_ALREADY_EXISTS,
          message: 'Data already exists',
          details: undefined,
        };
      case 'P2025': // record not found
        return {
          statusCode: HttpStatus.NOT_FOUND,
          errorCode: ErrorCode.RESOURCE_NOT_FOUND,
          message: 'Resource not found',
          details: undefined,
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          errorCode: ErrorCode.INTERNAL_ERROR,
          message: 'An unexpected error occurred',
          details: undefined,
        };
    }
  }

  private mapHttpStatus(status: number): string {
    if (status === Number(HttpStatus.UNAUTHORIZED))
      return ErrorCode.UNAUTHORIZED;
    if (status === Number(HttpStatus.NOT_FOUND))
      return ErrorCode.RESOURCE_NOT_FOUND;
    return ErrorCode.INTERNAL_ERROR;
  }

  private log(exception: unknown, body: ErrorResponse, request: Request): void {
    const context = `${request.method} ${request.url}`;
    // Log the exception with context

    if (body.statusCode >= 500) {
      this.logger.error(
        `${context} → ${body.errorCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${context} → ${body.errorCode}: ${body.message}`);
    }
  }
}
