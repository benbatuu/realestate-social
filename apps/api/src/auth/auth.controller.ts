import {
  loginRequestSchema,
  type LoginRequest,
  meResponseSchema,
  type MeResponse,
  registerRequestSchema,
  type RegisterRequest,
} from '@app/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  type AppRequest,
  type AuthContext,
  CurrentAuth,
  ReqId,
} from '../common/http/request-context';
import { ApiZodBody, ApiZodResponse, ZodPipe } from '../common/http/zod';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /** Self-service sign-up (assumption: not in blueprint §11.1, see docs/plan-01). */
  @Public()
  @Post('register')
  @ApiZodBody(registerRequestSchema)
  @ApiZodResponse(201, meResponseSchema)
  async register(
    @Body(new ZodPipe(registerRequestSchema)) body: RegisterRequest,
    @ReqId() requestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const session = await this.auth.register(body, requestId);
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return this.auth.me(session.userId);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(loginRequestSchema)
  @ApiZodResponse(200, meResponseSchema)
  async login(
    @Body(new ZodPipe(loginRequestSchema)) body: LoginRequest,
    @Req() req: AppRequest,
    @ReqId() requestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const session = await this.auth.login(body, req.ip, requestId);
    this.sessions.setCookie(res, session.token, session.expiresAt);
    return this.auth.me(session.userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentAuth() auth: AuthContext,
    @ReqId() requestId: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(auth.userId, auth.sessionId, requestId);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  @ApiZodResponse(200, meResponseSchema)
  me(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    return this.auth.me(auth.userId);
  }
}
