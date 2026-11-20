/**
 * Delivery-only entry point: everything the API needs when transformations
 * are off (DISABLE_TRANSFORMS=true). It deliberately does not import the
 * transform service or the image/video pipelines, so sharp is never loaded.
 */
export { enginePathsIn, type EnginePaths } from "./config/paths";
export type {
  RouteDeps,
  StorageAccess,
} from "./config/deps";
export type { TransformDefaults } from "./types";
export type { VideoJobQueue } from "./utils/video-job-queue";
export type {
  VideoJob as VideoJobRecord,
  JobStatus,
  JobStats,
  VideoJobStore,
} from "./utils/video/queue-store";

// Storage
export {
  CloudStorage,
  createStorageClient,
  type StorageConfig,
  type CacheEntry,
} from "./utils/storage/index";
export type { StorageClientOptions } from "./types";
export { invalidateListingCache } from "./utils/storage/listing-cache";
export { getBucketStats, type BucketStats } from "./utils/storage/stats-tracker";

// Delivery routes
export { createStorageRoute } from "./routes/storage";
export { createDownloadRoute } from "./routes/download";
export { createDownloadFolderRoute } from "./routes/download-folder";
export { createDownloadZipRoute } from "./routes/download-zip";
export { createInvalidateRoute } from "./routes/invalidate";
export { createRawRoute } from "./routes/raw";

// Shared utilities
export {
  validateApiSecret,
  generateUploadSignature,
  verifyUploadSignature,
} from "./utils/signature";
export {
  getUniqueFilePath,
  cleanStorageKey,
  parseParams,
  ALLOWED_UPLOAD_TYPES,
  stripUrlHostile,
  validateUploadFileType,
  validateUploadContent,
  contentTypeForExt,
  contentTypeForFormat,
  allowedUploadExtensions,
  isAudioExt,
  AUDIO_FORMATS,
} from "./url/index";
export { deleteAssetCompletely, type DeleteAssetResult } from "./utils/asset-deletion";
export {
  clearAllCache,
  deleteCachedFiles,
  getCacheSize,
  listCachedFiles,
} from "./utils/cache";
export { default as logger, serializeError } from "./utils/logger";
export {
  THUMBNAIL_PRIORITY,
  TRANSFORMATION_PRIORITY,
  detectVideoSettings,
  type VideoSettings,
} from "./utils/video/config";
