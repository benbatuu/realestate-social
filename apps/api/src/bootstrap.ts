import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@app/shared';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from './config/config.module';

/** HTTP setup shared by main.ts and the integration tests, so tests exercise the real wiring. */
export function configureHttpApp(app: INestApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(app.get(Logger));
  // Requests arrive through the Next.js rewrite: trust its X-Forwarded-For so req.ip is the
  // browser's address (used for login throttling). See TRUST_PROXY in env.ts.
  (app as NestExpressApplication).set('trust proxy', config.TRUST_PROXY);
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: config.APP_URL, credentials: true });
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder().setTitle('API').setVersion('v1').build();
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, () => SwaggerModule.createDocument(app, openApi));
}
