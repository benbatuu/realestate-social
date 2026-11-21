import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../common/http/app-error';
import { readCookie } from '../common/http/cookies';
import type { AppRequest } from '../common/http/request-context';
import { IS_PUBLIC } from './public.decorator';
import { SESSION_COOKIE, SessionService } from './session.service';

/**
 * Global, default-deny. Resolves the session cookie on every request; routes without
 * `@Public()` reject anonymous callers. Public routes still get `req.auth` when a valid
 * session is present.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    const session = token ? await this.sessions.resolve(token) : null;
    if (session) req.auth = { userId: session.userId, sessionId: session.sessionId };

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!isPublic && !req.auth) throw AppError.unauthenticated();
    return true;
  }
}
