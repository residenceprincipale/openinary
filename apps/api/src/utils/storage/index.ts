// Types
export type { StorageConfig, CacheEntry } from './types';

// Main classes (type-only to avoid loading @aws-sdk chain at module eval)
export type { CloudStorage } from './cloud-storage';
export { StorageCache } from './cache';
export type { S3ClientWrapper } from './s3-client';
export { KeyGenerator } from './key-generator';

// Factory functions
export { createStorageClient, createOptimizedStorageClient } from './factory';