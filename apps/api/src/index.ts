import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { allowedOrigins, getDb } from "shared";
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
import { logDelivery, noteApiUpload } from "./middleware/activity";
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

// Guards before Hono parses a multipart body into memory. MAX_FILE_SIZE_MB is
// per file; a request may carry several, so this is the whole-request cap.
const MAX_UPLOAD_BODY =
  (parseInt(process.env.MAX_UPLOAD_BODY_MB ?? "256", 10) || 256) * 1024 * 1024;

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
type RuntimeApps = ReturnType<TransformRuntime["createTransformApps"]>;

// The storage route only needs the job store to delete related jobs. With
// transforms off there are none, and importing VideoJobQueue would pull sharp.
const disabledQueue = {
  store: { deleteJobsByFilePath: () => 0 },
} as unknown as VideoJobQueue;

let runtimePromise:
  | Promise<{
      runtime: TransformRuntime;
      apps: RuntimeApps;
      transformService: ReturnType<
        TransformRuntime["createUploadTransformService"]
      >;
    }>
  | null = null;

/**
 * sharp/ffmpeg load on the first transform or upload prewarm, not at boot.
 * A pending job from a previous run triggers the same load from server.ts.
 */
function loadTransformRuntime() {
  runtimePromise ??= (async () => {
    const runtime = await import("./transform-runtime");
    // Storage deletes and upload prewarms read this at call time.
    deps.queue = runtime.videoJobQueue;
    runtime.startVideoQueue();
    return {
      runtime,
      apps: runtime.createTransformApps(deps),
      transformService: runtime.createUploadTransformService(deps),
    };
  })();
  return runtimePromise;
}

/** A sub-app that is only imported when its first request arrives. */
function lazyProxy(
  prefix: string,
  pick: (apps: RuntimeApps) => Hono,
): Hono {
  const proxy = new Hono();
  proxy.all("/*", async (c) => {
    const { apps } = await loadTransformRuntime();
    const url = new URL(c.req.url);
    url.pathname = url.pathname.slice(prefix.length) || "/";

    const init: RequestInit & { duplex?: "half" } = {
      method: c.req.method,
      headers: c.req.raw.headers,
    };
    if (c.req.method !== "GET" && c.req.method !== "HEAD") {
      init.body = c.req.raw.body;
      init.duplex = "half";
    }

    return pick(apps).fetch(new Request(url, init));
  });
  return proxy;
}

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
  queue: disabledQueue,
  paths: enginePaths,
  apiSecret: process.env.API_SECRET,
  allowRemoteSource: process.env.ALLOW_REMOTE_SOURCE === "true",
  // A getter, so saving the config page applies without a restart.
  defaults: getTransformDefaults,
  access,
};

const upload = createUploadRoute(deps, {
  transformsEnabled: !transformsDisabled,
  getTransformService: transformsDisabled
    ? undefined
    : async () => (await loadTransformRuntime()).transformService,
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
if (!transformsDisabled) {
  app.use("/video-status", publicRateLimit);
  app.use("/video-status/*", publicRateLimit);
  app.route("/video-status", lazyProxy("/video-status", (a) => a.videoStatus));

  app.use("/t", publicRateLimit);
  app.use("/t/*", publicRateLimit);
  app.use("/t/*", logDelivery("/t"));
  app.route("/t", lazyProxy("/t", (a) => a.transform));

  app.use("/authenticated", publicRateLimit);
  app.use("/authenticated/*", publicRateLimit);
  app.use("/authenticated/*", logDelivery("/authenticated"));
  app.route(
    "/authenticated",
    lazyProxy("/authenticated", (a) => a.authenticated),
  );

  // Public, and registered before the protected /queue/*.
  app.use("/queue/events", publicRateLimit);
  app.use("/queue/events/*", publicRateLimit);
  app.route("/queue/events", lazyProxy("/queue/events", (a) => a.queueEvents));

  app.use("/queue/*", apiKeyAuth);
  app.route("/queue", lazyProxy("/queue", (a) => a.queue));
}

app.use("/download", publicRateLimit);
app.use("/download/*", publicRateLimit);
app.route("/download", download);

app.use("/download-folder", publicRateLimit);
app.use("/download-folder/*", publicRateLimit);
app.route("/download-folder", downloadFolder);

app.use(
  "/upload",
  bodyLimit({
    maxSize: MAX_UPLOAD_BODY,
    onError: (c) =>
      c.json(
        {
          success: false,
          error: `Upload exceeds ${MAX_UPLOAD_BODY / 1024 / 1024}MB for one request. Raise MAX_UPLOAD_BODY_MB or split the batch.`,
        },
        413,
      ),
  }),
);

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

/**
 * Starts the video worker only when a previous run left work behind. Otherwise
 * the runtime loads on the first transform request, keeping sharp/ffmpeg out
 * of an idle process.
 */
export async function startBackgroundJobs(): Promise<void> {
  if (transformsDisabled) return;
  const pending = getDb()
    .prepare("SELECT 1 FROM video_jobs WHERE status IN ('pending', 'processing') LIMIT 1")
    .get();
  if (pending) await loadTransformRuntime();
}

export async function stopBackgroundJobs(): Promise<void> {
  if (!runtimePromise) return;
  const { runtime } = await runtimePromise;
  runtime.stopVideoQueue();
}

export default app;
