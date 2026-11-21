import type { LoginRequest, MeResponse, RegisterRequest } from '@app/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/http/app-error';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { dummyPasswordHash, hashPassword, verifyPassword } from './crypto';
import { LoginThrottleService } from './login-throttle.service';
import { SessionService } from './session.service';

export interface IssuedSession {
  token: string;
  expiresAt: Date;
  userId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly throttle: LoginThrottleService,
  ) {}

  async register(input: RegisterRequest, requestId: string | undefined): Promise<IssuedSession> {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email: input.email, name: input.name, passwordHash },
        });
        const session = await this.sessions.create(tx, user.id);
        await this.audit.record(tx, {
          action: 'auth.registered',
          actorUserId: user.id,
          targetType: 'user',
          targetId: user.id,
          requestId,
        });
        return { token: session.token, expiresAt: session.expiresAt, userId: user.id };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN', 'Email is already registered');
      }
      throw err;
    }
  }

  async login(
    input: LoginRequest,
    ip: string | undefined,
    requestId: string | undefined,
  ): Promise<IssuedSession> {
    await this.throttle.assertAllowed(input.email, ip);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Same work and same error whether the account is unknown, disabled or the password wrong.
    const valid = await verifyPassword(
      user?.passwordHash ?? (await dummyPasswordHash()),
      input.password,
    );
    if (!user || !valid || user.status !== 'ACTIVE') {
      await this.throttle.recordFailure(input.email, ip);
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        'INVALID_CREDENTIALS',
        'Invalid email or password',
      );
    }
    await this.throttle.reset(input.email);
    return this.prisma.$transaction(async (tx) => {
      const session = await this.sessions.create(tx, user.id);
      await this.audit.record(tx, {
        action: 'auth.logged_in',
        actorUserId: user.id,
        targetType: 'session',
        targetId: session.sessionId,
        requestId,
      });
      return { token: session.token, expiresAt: session.expiresAt, userId: user.id };
    });
  }

  async logout(userId: string, sessionId: string, requestId: string | undefined): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.session.deleteMany({ where: { id: sessionId } });
      await this.audit.record(tx, {
        action: 'auth.logged_out',
        actorUserId: userId,
        targetType: 'session',
        targetId: sessionId,
        requestId,
      });
    });
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          where: { tenant: { status: 'ACTIVE' } },
          orderBy: { createdAt: 'asc' },
          select: { role: true, tenant: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    return {
      user: { id: user.id, email: user.email, name: user.name },
      tenants: user.memberships.map((m) => ({ ...m.tenant, role: m.role })),
    };
  }
}
