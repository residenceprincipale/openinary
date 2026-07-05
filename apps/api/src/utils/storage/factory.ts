import type { StorageConfig } from 'shared';
import type { CloudStorage } from './cloud-storage';
import logger from '../logger';
import { createRequire } from 'module';
const req = createRequire(import.meta.url);

export function createStorageClient(): CloudStorage | null {
  const config: StorageConfig = {
    region: process.env.STORAGE_REGION || 'auto',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    bucketName: process.env.STORAGE_BUCKET_NAME || '',
    endpoint: process.env.STORAGE_ENDPOINT,
    publicUrl: process.env.STORAGE_PUBLIC_URL,
  };

  if (!config.accessKeyId || !config.secretAccessKey || !config.bucketName) {
    logger.warn('Storage configuration incomplete. Cloud storage disabled.');
    return null;
  }

  const { CloudStorage: CloudStorageClass } = req('./cloud-storage');
  return new CloudStorageClass(config);
}

export const createOptimizedStorageClient = createStorageClient;
