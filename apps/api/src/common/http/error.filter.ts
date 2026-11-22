import type { ApiErrorBody, ErrorCode } from '@app/shared';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from './app-error';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  413: 'FILE_TOO_LARGE',
  429: 'TOO_MANY_ATTEMPTS',
};

export function safeErrorSummary(err: unknown): { name: string; frames: string[] } {
  if (!(err instanceof Error)) return { name: typeof err, frames: [] };
  const frames = (err.stack ?? '')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .slice(0, 10)
    .map((line) => line.trim());
  return { name: err.name, frames };
}

/** Every error leaves the API as ApiErrorBody. Unexpected errors never expose internals. */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    let body: ApiErrorBody;

    if (exception instanceof AppError) {
      body = {
        statusCode: exception.getStatus(),
        code: exception.code,
        message: exception.message,
        ...(exception.issues ? { issues: exception.issues } : {}),
      };
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus();
      body = {
        statusCode: status,
        code: STATUS_CODES[status] ?? 'INTERNAL_ERROR',
        message: exception.message,
      };
    } else {
      // Name and stack frames only: messages (e.g. Prisma validation errors) can echo call
      // arguments such as email addresses or hashes.
      // One plain string: the object form was not reliably printed through the pino logger.
      const summary = safeErrorSummary(exception);
      this.logger.error(
        `unhandled error ${summary.name} at ${summary.frames.slice(0, 6).join(' | ')}`,
      );
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
      };
    }
    res.status(body.statusCode).json(body);
  }
}
