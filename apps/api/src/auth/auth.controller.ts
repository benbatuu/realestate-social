import {
  changePasswordRequestSchema,
  type ChangePasswordRequest,
  updateProfileRequestSchema,
  type UpdateProfileRequest,
  loginRequestSchema,
  type LoginRequest,
  meResponseSchema,
  type MeResponse,
  registerRequestSchema,
  type RegisterRequest,
} from '@app/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes } from '@nestjs/swagger';
import { AppError } from '../common/http/app-error';
import { UuidParam } from '../common/http/uuid-param';
import {
  accountDeletionSchema,
  deletionRequestSchema,
  type AccountDeletion,
  type DeletionRequest,
} from '@app/shared';
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

  @Patch('me')
  @ApiZodBody(updateProfileRequestSchema)
  @ApiZodResponse(200, meResponseSchema)
  updateProfile(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(updateProfileRequestSchema)) body: UpdateProfileRequest,
  ): Promise<MeResponse> {
    return this.auth.updateProfile(auth.userId, body);
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiZodResponse(201, meResponseSchema)
  uploadAvatar(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeResponse> {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_REQUIRED', 'A file is required');
    return this.auth.setAvatar(auth.userId, file.buffer);
  }

  @Delete('me/avatar')
  removeAvatar(@CurrentAuth() auth: AuthContext): Promise<MeResponse> {
    return this.auth.removeAvatar(auth.userId);
  }

  @Post('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiZodBody(changePasswordRequestSchema)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.auth.changePassword(auth.userId, auth.sessionId, body, requestId);
  }

  @Get('data-export')
  dataExport(@CurrentAuth() auth: AuthContext) {
    return this.auth.exportData(auth.userId);
  }

  @Post('data-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiZodBody(deletionRequestSchema)
  @ApiZodResponse(201, accountDeletionSchema)
  requestDeletion(
    @CurrentAuth() auth: AuthContext,
    @Body(new ZodPipe(deletionRequestSchema)) body: DeletionRequest,
    @ReqId() requestId: string | undefined,
  ): Promise<AccountDeletion> {
    return this.auth.requestDeletion(auth.userId, body, requestId);
  }

  @Get('data-requests/open')
  @ApiZodResponse(200, accountDeletionSchema.nullable())
  openDeletion(@CurrentAuth() auth: AuthContext): Promise<AccountDeletion | null> {
    return this.auth.openDeletion(auth.userId);
  }

  @Post('data-requests/:id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelDeletion(
    @CurrentAuth() auth: AuthContext,
    @Param('id', UuidParam) id: string,
    @ReqId() requestId: string | undefined,
  ): Promise<void> {
    await this.auth.cancelDeletion(auth.userId, id, requestId);
  }
}
