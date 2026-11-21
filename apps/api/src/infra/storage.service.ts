import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

/**
 * S3-compatible object storage. The bucket is private; files are served via short-lived
 * signed URLs (added with the first upload feature in M2).
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  readonly client: S3Client;
  readonly bucket: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.bucket = config.OBJECT_STORAGE_BUCKET;
    this.client = new S3Client({
      endpoint: config.OBJECT_STORAGE_ENDPOINT,
      region: config.OBJECT_STORAGE_REGION,
      forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY,
        secretAccessKey: config.OBJECT_STORAGE_SECRET_KEY,
      },
      maxAttempts: 2,
    });
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), {
      abortSignal: AbortSignal.timeout(2_000),
    });
  }

  /** Creates the bucket if it does not exist. Used by the local-dev setup script only. */
  async ensureBucket(): Promise<'created' | 'exists'> {
    try {
      await this.ping();
      return 'exists';
    } catch (err) {
      const status = err instanceof S3ServiceException ? err.$metadata.httpStatusCode : undefined;
      if (status !== 404) throw err;
    }
    await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
    return 'created';
  }

  onModuleDestroy(): void {
    this.client.destroy();
  }
}
