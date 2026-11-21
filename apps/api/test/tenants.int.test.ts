import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { generateToken, hashToken } from '../src/auth/crypto';
import { PrismaService } from '../src/infra/prisma.service';
import {
  createTenant,
  createTestApp,
  registerAgent,
  resetState,
  subscribe,
  tokenFromAcceptUrl,
  uniqueEmail,
} from './helpers';

describe('tenants, memberships and invitations', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetState(app));
  afterAll(() => app?.close());

  it('creates a workspace with the creator as OWNER', async () => {
    const { agent, userId } = await registerAgent(app);
    const res = await agent.post('/api/v1/tenants').send({ name: 'Şişli Emlak' }).expect(201);
    expect(res.body).toMatchObject({ name: 'Şişli Emlak', role: 'OWNER' });
    expect(res.body.slug).toMatch(/^sisli-emlak-[0-9a-f]{6}$/);

    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.tenants).toEqual([res.body]);

    const members = await agent.get(`/api/v1/tenants/${res.body.id}/members`).expect(200);
    expect(members.body).toHaveLength(1);
    expect(members.body[0]).toMatchObject({ role: 'OWNER', user: { id: userId } });
  });

  it('without a plan the workspace has one seat and cannot invite', async () => {
    const { agent } = await registerAgent(app);
    const tenantId = await createTenant(agent);
    const ent = await agent.get(`/api/v1/tenants/${tenantId}/entitlements`).expect(200);
    expect(ent.body).toEqual({
      planCode: null,
      planName: null,
      maxSeats: 1,
      usedSeats: 1,
      pendingInvitations: 0,
    });
    const res = await agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email: uniqueEmail(), role: 'MEMBER' })
      .expect(409);
    expect(res.body.code).toBe('SEAT_LIMIT_REACHED');
  });

  it('acceptance #1: workspace is created and a user is invited and joins', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'growth');

    const inviteeEmail = uniqueEmail('invitee');
    const invite = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email: inviteeEmail.toUpperCase(), role: 'MEMBER' })
      .expect(201);
    expect(invite.body.invitation).toMatchObject({ email: inviteeEmail, status: 'PENDING' });
    expect(invite.body.acceptUrl).toMatch(/\/invite#token=/);
    const token = tokenFromAcceptUrl(invite.body.acceptUrl);

    const pending = await owner.agent.get(`/api/v1/tenants/${tenantId}/invitations`).expect(200);
    expect(pending.body).toHaveLength(1);

    const preview = await request(app.getHttpServer())
      .post('/api/v1/invitations/preview')
      .send({ token })
      .expect(200);
    expect(preview.body).toMatchObject({ email: inviteeEmail, role: 'MEMBER', state: 'valid' });

    const invitee = await registerAgent(app, inviteeEmail, 'Mehmet');
    const accepted = await invitee.agent
      .post('/api/v1/invitations/accept')
      .send({ token })
      .expect(200);
    expect(accepted.body).toMatchObject({ id: tenantId, role: 'MEMBER' });

    const members = await owner.agent.get(`/api/v1/tenants/${tenantId}/members`).expect(200);
    expect(members.body.map((m: { role: string }) => m.role)).toEqual(['OWNER', 'MEMBER']);

    // Single use.
    const reuse = await invitee.agent
      .post('/api/v1/invitations/accept')
      .send({ token })
      .expect(404);
    expect(reuse.body.code).toBe('INVITATION_INVALID');
    const used = await request(app.getHttpServer())
      .post('/api/v1/invitations/preview')
      .send({ token })
      .expect(200);
    expect(used.body.state).toBe('used');
  });

  it('only the invited email can accept', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'growth');
    const invite = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email: uniqueEmail('intended'), role: 'MEMBER' })
      .expect(201);
    const stranger = await registerAgent(app);
    const res = await stranger.agent
      .post('/api/v1/invitations/accept')
      .send({ token: tokenFromAcceptUrl(invite.body.acceptUrl) })
      .expect(403);
    expect(res.body.code).toBe('INVITATION_EMAIL_MISMATCH');
  });

  it('rejects expired invitations', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'growth');
    const invitee = await registerAgent(app);
    const token = generateToken();
    await app.get(PrismaService).invitation.create({
      data: {
        tenantId,
        email: invitee.email,
        role: 'MEMBER',
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
        invitedByUserId: owner.userId,
      },
    });
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(404);
  });

  it('enforces roles: members and managers cannot invite, nobody can invite an OWNER', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'agency');

    for (const role of ['MEMBER', 'MANAGER'] as const) {
      const email = uniqueEmail(role.toLowerCase());
      const invite = await owner.agent
        .post(`/api/v1/tenants/${tenantId}/invitations`)
        .send({ email, role })
        .expect(201);
      const user = await registerAgent(app, email);
      await user.agent
        .post('/api/v1/invitations/accept')
        .send({ token: tokenFromAcceptUrl(invite.body.acceptUrl) })
        .expect(200);
      const denied = await user.agent
        .post(`/api/v1/tenants/${tenantId}/invitations`)
        .send({ email: uniqueEmail(), role: 'VIEWER' })
        .expect(403);
      expect(denied.body.code).toBe('FORBIDDEN');
      await user.agent.get(`/api/v1/tenants/${tenantId}/invitations`).expect(403);
      // Plain members can still read the member list.
      await user.agent.get(`/api/v1/tenants/${tenantId}/members`).expect(200);
    }

    const ownerInvite = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email: uniqueEmail(), role: 'OWNER' })
      .expect(400);
    expect(ownerInvite.body.code).toBe('VALIDATION_FAILED');
  });

  it('counts pending invitations against seats and re-inviting replaces the old link', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'starter'); // 2 seats: owner + one more

    const email = uniqueEmail();
    const first = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    const full = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email: uniqueEmail(), role: 'MEMBER' })
      .expect(409);
    expect(full.body.code).toBe('SEAT_LIMIT_REACHED');

    // Same address again: allowed, and the first link stops working.
    const second = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'ADMIN' })
      .expect(201);
    const invitee = await registerAgent(app, email);
    await invitee.agent
      .post('/api/v1/invitations/accept')
      .send({ token: tokenFromAcceptUrl(first.body.acceptUrl) })
      .expect(404);
    const ok = await invitee.agent
      .post('/api/v1/invitations/accept')
      .send({ token: tokenFromAcceptUrl(second.body.acceptUrl) })
      .expect(200);
    expect(ok.body.role).toBe('ADMIN');
  });

  it('two concurrent accepts cannot both take the last seat', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'starter'); // 1 free seat

    // Two pending invitations for one seat (e.g. sent before a downgrade), inserted directly.
    const prisma = app.get(PrismaService);
    const invitees = await Promise.all([registerAgent(app), registerAgent(app)]);
    const tokens = await Promise.all(
      invitees.map(async (u) => {
        const token = generateToken();
        await prisma.invitation.create({
          data: {
            tenantId,
            email: u.email,
            role: 'MEMBER',
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 3600_000),
            invitedByUserId: owner.userId,
          },
        });
        return token;
      }),
    );

    const results = await Promise.all(
      invitees.map((u, i) => u.agent.post('/api/v1/invitations/accept').send({ token: tokens[i] })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    expect(results.find((r) => r.status === 409)?.body.code).toBe('SEAT_LIMIT_REACHED');
    expect(await prisma.membership.count({ where: { tenantId } })).toBe(2);

    // The losing invitation was not consumed (its transaction rolled back).
    const stillPending = await prisma.invitation.count({ where: { tenantId, status: 'PENDING' } });
    expect(stillPending).toBe(1);
  });

  it('one token accepted twice in parallel creates one membership', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'growth');
    const email = uniqueEmail();
    const invite = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    const invitee = await registerAgent(app, email);
    const token = tokenFromAcceptUrl(invite.body.acceptUrl);
    const results = await Promise.all([
      invitee.agent.post('/api/v1/invitations/accept').send({ token }),
      invitee.agent.post('/api/v1/invitations/accept').send({ token }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
    const prisma = app.get(PrismaService);
    expect(await prisma.membership.count({ where: { tenantId, userId: invitee.userId } })).toBe(1);
  });

  it('writes audit entries with IDs only', async () => {
    const owner = await registerAgent(app);
    const tenantId = await createTenant(owner.agent);
    await subscribe(app, tenantId, 'growth');
    const email = uniqueEmail();
    const invite = await owner.agent
      .post(`/api/v1/tenants/${tenantId}/invitations`)
      .send({ email, role: 'MEMBER' })
      .expect(201);
    const token = tokenFromAcceptUrl(invite.body.acceptUrl);
    const invitee = await registerAgent(app, email);
    await invitee.agent.post('/api/v1/invitations/accept').send({ token }).expect(200);

    const logs = await app.get(PrismaService).auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs.map((l) => l.action)).toEqual([
      'tenant.created',
      'invitation.created',
      'invitation.accepted',
      'membership.created',
    ]);
    const serialized = JSON.stringify(logs);
    expect(serialized).not.toContain(email);
    expect(serialized).not.toContain(owner.email);
    expect(serialized).not.toContain(token);
  });
});
