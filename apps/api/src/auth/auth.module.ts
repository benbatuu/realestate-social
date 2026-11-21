import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from '../audit/audit.module';
import { OriginGuard } from '../common/http/origin.guard';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { LoginThrottleService } from './login-throttle.service';
import { SessionService } from './session.service';

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    LoginThrottleService,
    // Order matters: CSRF origin check, then authentication.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [SessionService, AuthService],
})
export class AuthModule {}
