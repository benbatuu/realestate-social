import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { AppError } from './app-error';
import type { AppRequest } from './request-context';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie sessions, together with SameSite=Lax cookies and JSON-only bodies:
 * a state-changing request that carries an Origin header must come from the web app.
 * Non-browser clients send no Origin and are unaffected.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.allowed = new URL(config.APP_URL).origin;
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    const origin = req.headers.origin;
    if (origin === undefined || origin === this.allowed) return true;
    throw new AppError(HttpStatus.FORBIDDEN, 'ORIGIN_NOT_ALLOWED', 'Origin not allowed');
  }
}
