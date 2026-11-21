import { Inject, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../infra/prisma.service';
import { generateToken, hashToken } from './crypto';

export const SESSION_COOKIE = 'sid';
const DAY_MS = 24 * 60 * 60 * 1000;
/** Avoid a write on every request: lastUsedAt is refreshed at most this often. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export interface ResolvedSession {
  sessionId: string;
  userId: string;
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async create(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ token: string; sessionId: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + this.config.SESSION_TTL_DAYS * DAY_MS);
    const session = await tx.session.create({
      data: { userId, tokenHash: hashToken(token), expiresAt },
    });
    return { token, sessionId: session.id, expiresAt };
  }

  async resolve(token: string): Promise<ResolvedSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: { status: true } } },
    });
    if (!session || session.expiresAt <= new Date() || session.user.status !== 'ACTIVE') {
      return null;
    }
    if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { lastUsedAt: new Date() },
      });
    }
    return { sessionId: session.id, userId: session.userId };
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id: sessionId } });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.NODE_ENV === 'production',
      path: '/',
      expires: expiresAt,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.NODE_ENV === 'production',
      path: '/',
    });
  }
}
