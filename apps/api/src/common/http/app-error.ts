import type { ErrorCode } from '@app/shared';
import { HttpException, HttpStatus } from '@nestjs/common';

/** HTTP error with a stable machine-readable code (see @app/shared ERROR_CODES). */
export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string,
    readonly issues?: { path: string; message: string }[],
  ) {
    super({ code, message, ...(issues ? { issues } : {}) }, status);
  }

  static notFound(message = 'Not found'): AppError {
    return new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', message);
  }

  static forbidden(message = 'Forbidden'): AppError {
    return new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', message);
  }

  static unauthenticated(): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Authentication required');
  }
}
