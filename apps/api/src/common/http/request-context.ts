import type { MembershipRole } from '@app/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from './app-error';

export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface TenantContext {
  tenantId: string;
  role: MembershipRole;
}

/** `id` is the correlation ID set by pino-http (typed by its IncomingMessage augmentation). */
export interface AppRequest extends Request {
  auth?: AuthContext;
  tenant?: TenantContext;
}

export function requestId(req: AppRequest): string | undefined {
  const id: unknown = req.id;
  return typeof id === 'string' ? id : undefined;
}

/** The authenticated user. Only valid behind the global AuthGuard (i.e. non-public routes). */
export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
});

/** The verified tenant membership. Only valid on routes guarded by TenantGuard. */
export const CurrentTenant = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<AppRequest>();
  if (!req.tenant) throw new Error('CurrentTenant used on a route without TenantGuard');
  return req.tenant;
});

export const ReqId = createParamDecorator((_: unknown, ctx: ExecutionContext) =>
  requestId(ctx.switchToHttp().getRequest<AppRequest>()),
);
