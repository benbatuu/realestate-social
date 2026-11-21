import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { API_PREFIX } from '@app/shared';
import { Logger } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from './config/config.module';

/** HTTP setup shared by main.ts and the integration tests, so tests exercise the real wiring. */
export function configureHttpApp(app: INestApplication): void {
  const config = app.get<AppConfig>(APP_CONFIG);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({ origin: config.APP_URL, credentials: true });
  app.enableShutdownHooks();

  const openApi = new DocumentBuilder().setTitle('API').setVersion('v1').build();
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, () => SwaggerModule.createDocument(app, openApi));
}
