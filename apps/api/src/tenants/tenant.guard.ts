import { TENANT_HEADER, type MembershipRole } from '@app/shared';
import {
  applyDecorators,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiHeader, ApiNotFoundResponse } from '@nestjs/swagger';
import { z } from 'zod';
import { AppError } from '../common/http/app-error';
import type { AppRequest } from '../common/http/request-context';
import { PrismaService } from '../infra/prisma.service';
import { hasAtLeast } from './roles';

const MIN_ROLE = 'tenant:minRole';
const uuid = z.uuid();

/**
 * Resolves the active tenant and proves the caller belongs to it (blueprint §11: a client-sent
 * tenant ID is never proof of access). The tenant comes from the `:tenantId` path param when the
 * route has one, otherwise from the X-Tenant-Id header. Non-members get 404 so tenant IDs cannot
 * be probed; members below the required role get 403.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    if (!req.auth) throw AppError.unauthenticated();

    const fromParam = req.params['tenantId'];
    const fromHeader = req.headers[TENANT_HEADER];
    const raw = typeof fromParam === 'string' ? fromParam : fromHeader;
    const tenantId = typeof raw === 'string' && uuid.safeParse(raw).success ? raw : undefined;
    if (!tenantId) throw AppError.notFound('Workspace not found');

    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId: req.auth.userId } },
      select: { role: true, tenant: { select: { status: true } } },
    });
    if (!membership || membership.tenant.status !== 'ACTIVE') {
      throw AppError.notFound('Workspace not found');
    }

    const minRole = this.reflector.getAllAndOverride<MembershipRole | undefined>(MIN_ROLE, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (minRole && !hasAtLeast(membership.role, minRole)) {
      throw AppError.forbidden('Insufficient role');
    }

    req.tenant = { tenantId, role: membership.role };
    return true;
  }
}

/**
 * Marks a route as tenant-scoped. Every tenant-scoped query must also filter by the resolved
 * tenantId (use `@CurrentTenant()`), never by an ID from the request alone.
 */
export function TenantScoped(minRole?: MembershipRole) {
  return applyDecorators(
    SetMetadata(MIN_ROLE, minRole),
    UseGuards(TenantGuard),
    ApiHeader({ name: TENANT_HEADER, required: false, description: 'Active workspace ID' }),
    ApiNotFoundResponse({ description: 'Workspace not found or caller is not a member' }),
  );
}
