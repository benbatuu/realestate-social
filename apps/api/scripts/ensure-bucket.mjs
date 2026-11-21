// Local-dev helper: creates the object-storage bucket from the root .env if it is missing.
// Plain JS on purpose so it runs with bare `node` before anything is built.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, '../../../.env'), quiet: true });

const env = process.env;
const bucket = env.OBJECT_STORAGE_BUCKET;
const client = new S3Client({
  endpoint: env.OBJECT_STORAGE_ENDPOINT,
  region: env.OBJECT_STORAGE_REGION,
  forcePathStyle: env.OBJECT_STORAGE_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY ?? '',
    secretAccessKey: env.OBJECT_STORAGE_SECRET_KEY ?? '',
  },
});

try {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
  console.log(`bucket "${bucket}": exists`);
} catch (err) {
  if (err?.$metadata?.httpStatusCode !== 404) {
    console.error('ensure-bucket failed:', err?.name ?? err);
    process.exit(1);
  }
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`bucket "${bucket}": created`);
} finally {
  client.destroy();
}
