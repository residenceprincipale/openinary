import { Hono, type Context } from "hono";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { allowedOrigins } from "shared";
import {
  createStorageRoute,
  createDownloadRoute,
  createDownloadFolderRoute,
  createDownloadZipRoute,
  createInvalidateRoute,
  createRawRoute,
  validateApiSecret,
  logger,
  serializeError,
  type RouteDeps,
  type StorageAccess,
  type VideoJobQueue,
} from "@openinary/core/light";
import { createUploadRoute } from "./routes/upload";
import apiKeys from "./routes/api-keys";
import activity from "./routes/activity";
import onboarding from "./routes/onboarding";
import health from "./routes/health";
import cache from "./routes/cache";
import config from "./routes/config";
import users from "./routes/users";
import { createStorageExtras } from "./routes/storage-extras";
import { noteApiUpload } from "./middleware/activity";
import { apiKeyAuth, type AuthVariables } from "./middleware/auth";
import { publicRateLimit } from "./middleware/rate-limit";
import { getSharedStorage } from "./config/storage";
import { enginePaths } from "./config/paths";
import { getTransformDefaults } from "./utils/transform-defaults";
import { getUserAccessiblePaths, hasPermission } from "./utils/permissions";

/**
 * DISABLE_TRANSFORMS=true turns this into a delivery-only server: no /t, no
 * video queue, and sharp/ffmpeg are never imported, which keeps the process'
 * memory flat. Uploads still work; prewarm requests are ignored.
 */
export const transformsDisabled = process.env.DISABLE_TRANSFORMS === "true";

// Logged, not fatal: only /authenticated and presigned uploads need the
// secret, and they answer 500 without it.
if (!transformsDisabled) {
  try {
    validateApiSecret(process.env.API_SECRET);
  } catch (error) {
    logger.error(
      { error: serializeError(error) },
      "API_SECRET validation failed at startup",
    );
  }
}

type TransformRuntime = typeof import("./transform-runtime");

let transformRuntime: TransformRuntime | null = null;
if (!transformsDisabled) {
  transformRuntime = await import("./transform-runtime");
}

// The storage route only needs the job store to delete related jobs. With
// transforms off there are none, and importing VideoJobQueue would pull sharp.
const disabledQueue = {
  store: { deleteJobsByFilePath: () => 0 },
} as unknown as VideoJobQueue;

const queue = transformRuntime?.videoJobQueue ?? disabledQueue;

const access: StorageAccess = {
  visiblePaths(c) {
    const user = (c as Context<AuthVariables>).get("user");
    if (!user) return [];
    return user.role === "admin" ? null : getUserAccessiblePaths(user.id);
  },
  canWrite(c, folder) {
    const user = (c as Context<AuthVariables>).get("user");
    // No user is a presigned upload: /upload/sign checked the folder.
    if (!user) return true;
    return user.role === "admin" || hasPermission(folder, user.id);
  },
};

const deps: RouteDeps = {
  storage: getSharedStorage(),
  queue,
  paths: enginePaths,
  apiSecret: process.env.API_SECRET,
  allowRemoteSource: process.env.ALLOW_REMOTE_SOURCE === "true",
  // A getter, so saving the config page applies without a restart.
  defaults: getTransformDefaults,
  access,
};

const upload = createUploadRoute(deps, {
  transformsEnabled: !transformsDisabled,
  transformService: transformRuntime?.createUploadTransformService(deps),
});
const storageRoute = createStorageRoute(deps);
const download = createDownloadRoute(deps);
const downloadFolder = createDownloadFolderRoute(deps);
const downloadZip = createDownloadZipRoute(deps);
const invalidateRoute = createInvalidateRoute(deps);
const raw = createRawRoute(deps);

const app = new Hono();

// Credentials allowed for the dashboard's session cookie.
app.use(
  "/*",
  cors({
    origin: (origin) => {
      // CORS_ORIGIN: comma-separated sites embedding the file uploader.
      const allowed = [
        ...allowedOrigins(),
        ...(process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ?? []),
      ];
      if (!origin || allowed.includes("*")) return origin || "*";
      // Empty for a disallowed origin, so the browser blocks the response.
      return allowed.includes(origin) ? origin : "";
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true,
    exposeHeaders: ["Set-Cookie"],
  }),
);

// Public routes are rate limited here; protected ones by Better Auth's API
// key plugin.
app.get("/", publicRateLimit, (c) =>
  c.text("Openinary API Server is running."),
);

app.use("/health", publicRateLimit);
app.use("/health/*", publicRateLimit);
app.route("/health", health);

// /t, /authenticated, /video-status and /queue are only mounted when
// transforms are on.
transformRuntime?.registerTransformRoutes(app, deps);

app.use("/download", publicRateLimit);
app.use("/download/*", publicRateLimit);
app.route("/download", download);

app.use("/download-folder", publicRateLimit);
app.use("/download-folder/*", publicRateLimit);
app.route("/download-folder", downloadFolder);

// POST /upload accepts either a real API key/session, or a short-lived
// presigned signature minted by POST /upload/sign, so it gets its own
// auth handling (see presignedOrApiKeyAuth) plus public rate limiting,
// while the other /upload/* subroutes stay strictly API-key protected.
app.use("/upload", publicRateLimit);
app.use("/upload", noteApiUpload);
app.use("/upload/sign", apiKeyAuth);
app.use("/upload/createfolder", apiKeyAuth);
app.route("/upload", upload);

// Compression scoped to /storage (large JSON listings); not global because
// /queue/events streams SSE and /t/* serves already-compressed media
app.use("/storage/*", compress());
app.use("/storage/*", apiKeyAuth);
// Sharing and replace-file routes read the users table, so they stay here
// and are mounted before the core storage route.
app.route("/storage", createStorageExtras());
app.route("/storage", storageRoute);

app.use("/download-zip", apiKeyAuth);
app.use("/download-zip/*", apiKeyAuth);
app.route("/download-zip", downloadZip);

app.use("/invalidate/*", apiKeyAuth);
app.route("/invalidate", invalidateRoute);

app.use("/activity", apiKeyAuth);
app.use("/activity/*", apiKeyAuth);
app.route("/activity", activity);

app.use("/onboarding", apiKeyAuth);
app.use("/onboarding/*", apiKeyAuth);
app.route("/onboarding", onboarding);

app.use("/cache", apiKeyAuth);
app.use("/cache/*", apiKeyAuth);
app.route("/cache", cache);

app.use("/config", apiKeyAuth);
app.use("/config/*", apiKeyAuth);
app.route("/config", config);

// Applies apiKeyAuth itself.
app.route("/users", users);

// Applies apiKeyAuth itself.
app.route("/api-keys", apiKeys);

// Originals at their root path (/photos/a.jpg), inline and Range-capable.
// Last: every API route above wins.
app.route("/", raw);

/** Starts the video worker; a no-op when transforms are off. */
export function startBackgroundJobs(): void {
  transformRuntime?.startVideoQueue();
}

export function stopBackgroundJobs(): void {
  transformRuntime?.stopVideoQueue();
}

export default app;
