import { Global, Module } from '@nestjs/common';
import { assertProviderConfig, parseEnv, type Env } from './env';

export const APP_CONFIG = Symbol('APP_CONFIG');
export type AppConfig = Env;

@Global()
@Module({
  providers: [
    {
      provide: APP_CONFIG,
      useFactory: (): AppConfig => {
        const env = parseEnv(process.env);
        assertProviderConfig(env);
        return env;
      },
    },
  ],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
