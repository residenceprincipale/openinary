import { getDb } from "shared";
import type { Hono } from "hono";
import {
  createAuthenticatedRoute,
  createQueueEventsRoute,
  createQueueRoute,
  createTransformRoute,
  createVideoStatusRoute,
  TransformService,
  VideoJobQueue,
  type RouteDeps,
} from "@openinary/core";

import { getSharedStorage } from "./config/storage";
import { enginePaths } from "./config/paths";
import { SqliteVideoJobStore } from "./config/video-job-store";
import { getTransformDefaults } from "./utils/transform-defaults";
import { apiKeyAuth } from "./middleware/auth";
import { logDelivery } from "./middleware/activity";
import { publicRateLimit } from "./middleware/rate-limit";

/**
 * Everything that needs sharp/ffmpeg. Imported dynamically by index.ts only
 * when DISABLE_TRANSFORMS is off, so the delivery-only API never loads them.
 */

const intEnv = (name: string): number | undefined => {
  const value = parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) ? value : undefined;
};

export const videoJobQueue = new VideoJobQueue(
  new SqliteVideoJobStore(getDb(), intEnv("VIDEO_JOB_RETRY_MAX")),
  getSharedStorage(),
  {
    paths: enginePaths,
    defaults: getTransformDefaults,
    video: {
      maxConcurrent: intEnv("VIDEO_MAX_CONCURRENT"),
      ffmpegThreads: intEnv("VIDEO_FFMPEG_THREADS"),
      ffmpegNiceness: intEnv("VIDEO_FFMPEG_NICENESS"),
      cleanupHours: intEnv("VIDEO_JOB_CLEANUP_HOURS"),
      pollIntervalMs: intEnv("VIDEO_WORKER_POLL_INTERVAL_MS"),
    },
  },
);

export function createUploadTransformService(deps: RouteDeps) {
  return new TransformService(deps.storage, deps.queue, deps.paths, deps.defaults);
}

/** Mounts /t, /authenticated, /video-status, /queue/events and /queue. */
export function registerTransformRoutes(app: Hono, deps: RouteDeps) {
  const transform = createTransformRoute(deps);
  const authenticated = createAuthenticatedRoute(deps);
  const videoStatus = createVideoStatusRoute(deps);
  const queueEvents = createQueueEventsRoute(deps);
  const queue = createQueueRoute(deps);

  app.use("/video-status", publicRateLimit);
  app.use("/video-status/*", publicRateLimit);
  app.route("/video-status", videoStatus);

  app.use("/t", publicRateLimit);
  app.use("/t/*", publicRateLimit);
  app.use("/t/*", logDelivery("/t"));
  app.route("/t", transform);

  app.use("/authenticated", publicRateLimit);
  app.use("/authenticated/*", publicRateLimit);
  app.use("/authenticated/*", logDelivery("/authenticated"));
  app.route("/authenticated", authenticated);

  // Public, and registered before the protected /queue/*.
  app.use("/queue/events", publicRateLimit);
  app.use("/queue/events/*", publicRateLimit);
  app.route("/queue/events", queueEvents);

  app.use("/queue/*", apiKeyAuth);
  app.route("/queue", queue);
}

export function startVideoQueue(): void {
  videoJobQueue.start();
}

export function stopVideoQueue(): void {
  videoJobQueue.stop();
}
