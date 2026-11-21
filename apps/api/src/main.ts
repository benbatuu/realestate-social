import 'reflect-metadata';
import { loadLocalEnvFile } from './config/load-dotenv';
loadLocalEnvFile();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureHttpApp } from './bootstrap';
import { APP_CONFIG, type AppConfig } from './config/config.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  configureHttpApp(app);
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.API_PORT);
}

bootstrap().catch((err: unknown) => {
  // The logger may not exist yet (e.g. invalid env), so fall back to stderr.
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
