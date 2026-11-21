import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/infra/prisma.service';
import { createTestApp, PASSWORD, registerAgent, resetState, uniqueEmail } from './helpers';

describe('auth', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetState(app));
  afterAll(() => app?.close());

  it('registers, sets an httpOnly session cookie and returns the user', async () => {
    const email = uniqueEmail();
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ name: 'Ayşe', email: `  ${email.toUpperCase()} `, password: PASSWORD })
      .expect(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.tenants).toEqual([]);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('stores only hashes of passwords and session tokens', async () => {
    const { agent, userId } = await registerAgent(app);
    const prisma = app.get(PrismaService);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.passwordHash).not.toContain(PASSWORD);
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    const sessions = await prisma.session.findMany({ where: { userId } });
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.user.id).toBe(userId);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const { email } = await registerAgent(app);
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ name: 'Dup', email: email.toUpperCase(), password: PASSWORD })
      .expect(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('validates input with field-level issues', async () => {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ name: 'x', email: 'not-an-email', password: 'short' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    const paths = (res.body.issues as { path: string }[]).map((i) => i.path).sort();
    expect(paths).toEqual(['email', 'name', 'password']);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const { email } = await registerAgent(app);
    const wrongPassword = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-password-123' })
      .expect(401);
    const unknownEmail = await http()
      .post('/api/v1/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'wrong-password-123' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in, and logout invalidates the session', async () => {
    const { email } = await registerAgent(app);
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD }).expect(200);
    await agent.get('/api/v1/auth/me').expect(200);
    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.get('/api/v1/auth/me').expect(401);
  });

  it('denies non-public routes without a session (default-deny)', async () => {
    const res = await http().get('/api/v1/tenants').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
    await http().get('/api/v1/auth/me').expect(401);
    await http().get('/api/v1/health').expect(200);
  });

  it('rejects state-changing requests from a foreign origin', async () => {
    const res = await http()
      .post('/api/v1/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: uniqueEmail(), password: PASSWORD })
      .expect(403);
    expect(res.body.code).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('throttles repeated failed logins for one email', async () => {
    const { email } = await registerAgent(app);
    for (let i = 0; i < 10; i++) {
      await http()
        .post('/api/v1/auth/login')
        .send({ email, password: 'nope-nope-nope' })
        .expect(401);
    }
    const blocked = await http()
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD })
      .expect(429);
    expect(blocked.body.code).toBe('TOO_MANY_ATTEMPTS');
  });
});

describe('client IP behind the web proxy', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => resetState(app));
  afterAll(() => app?.close());

  it('throttles per forwarded client IP, not per proxy address', async () => {
    // Supertest connects from loopback, like the Next.js rewrite. 50 failures from one client
    // (different emails) must not block a different client behind the same proxy.
    for (let i = 0; i < 50; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', '203.0.113.10')
        .send({ email: uniqueEmail('spray'), password: 'wrong-password-1' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '203.0.113.10')
      .send({ email: uniqueEmail('spray'), password: 'wrong-password-1' })
      .expect(429);

    const { email } = await registerAgent(app);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', '198.51.100.20')
      .send({ email, password: PASSWORD })
      .expect(200);
  });
});
