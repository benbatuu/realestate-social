import {
  CreateBucketCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

export const SIGNED_URL_TTL_SECONDS = 15 * 60;

/**
 * S3-compatible object storage. The bucket is private: browsers only get short-lived signed
 * GET URLs (§8.6), minted against the public endpoint when it differs from the internal one.
 */
@Injectable()
export class StorageService implements OnModuleDestroy {
  readonly client: S3Client;
  private readonly signer: S3Client;
  readonly bucket: string;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.bucket = config.OBJECT_STORAGE_BUCKET;
    const base = {
      region: config.OBJECT_STORAGE_REGION,
      forcePathStyle: config.OBJECT_STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY,
        secretAccessKey: config.OBJECT_STORAGE_SECRET_KEY,
      },
      maxAttempts: 3,
    };
    this.client = new S3Client({ ...base, endpoint: config.OBJECT_STORAGE_ENDPOINT });
    this.signer = new S3Client({
      ...base,
      endpoint: config.OBJECT_STORAGE_PUBLIC_ENDPOINT ?? config.OBJECT_STORAGE_ENDPOINT,
    });
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), {
      abortSignal: AbortSignal.timeout(2_000),
    });
  }

  /** Creates the bucket if it does not exist. Used by local-dev and test setup only. */
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

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
      { abortSignal: AbortSignal.timeout(60_000) },
    );
  }

  async getBuffer(key: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      abortSignal: AbortSignal.timeout(60_000),
    });
    if (!res.Body) throw new Error('Empty object body');
    return Buffer.from(await res.Body.transformToByteArray());
  }

  /** Deletes keys; missing keys are not an error. */
  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  /**
   * Short-lived read link. With `fileName`, the browser saves the file under that name
   * (sets Content-Disposition on the response, which works cross-origin).
   */
  signedGetUrl(key: string, opts: { fileName?: string } = {}): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ...(opts.fileName
        ? {
            ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(opts.fileName)}`,
          }
        : {}),
    });
    return getSignedUrl(this.signer, command, { expiresIn: SIGNED_URL_TTL_SECONDS });
  }

  onModuleDestroy(): void {
    this.client.destroy();
    this.signer.destroy();
  }
}
