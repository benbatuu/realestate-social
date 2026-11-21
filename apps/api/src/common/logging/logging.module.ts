import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { APP_CONFIG, type AppConfig } from '../../config/config.module';
import { resolveCorrelationId } from './correlation-id';
import { REDACT_CENSOR, REDACT_PATHS, serializeRequest } from './redaction';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        pinoHttp: {
          level: config.LOG_LEVEL,
          genReqId: resolveCorrelationId,
          redact: { paths: REDACT_PATHS, censor: REDACT_CENSOR },
          serializers: { req: serializeRequest },
          ...(config.NODE_ENV === 'development'
            ? {
                // Resolved from this package: pino would otherwise look it up from its own
                // location, which pnpm's strict layout does not expose.
                transport: {
                  target: require.resolve('pino-pretty'),
                  options: { singleLine: true },
                },
              }
            : {}),
        },
      }),
    }),
  ],
})
export class LoggingModule {}
