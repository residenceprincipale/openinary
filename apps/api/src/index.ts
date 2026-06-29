import { Hono } from "hono";
import { cors } from "hono/cors";
import upload from "./routes/upload";
import storageRoute from "./routes/storage";
import download from "./routes/download";
import apiKeys from "./routes/api-keys";
import health from "./routes/health";
import logger, { serializeError } from "./utils/logger";
import invalidateRoute from "./routes/invalidate";
import cacheRoute from "./routes/cache";
import usersRoute from "./routes/users";
import configRoute from "./routes/config";
import { apiKeyAuth } from "./middleware/auth";
import { publicRateLimit } from "./middleware/rate-limit";
import { validateApiSecret } from "./utils/signature";
import { isTransformSegment } from "./utils/parser";
import { createStorageClient } from "./utils/storage/index";
import { safePath } from "./utils/path-security";
import fs from "fs";
import path from "path";

const disableTransforms = process.env.DISABLE_TRANSFORMS === "true";

// Validate API_SECRET at startup if authenticated routes are enabled
if (!disableTransforms) {
  try {
    validateApiSecret(process.env.API_SECRET);
  } catch (error) {
    logger.error({ error: serializeError(error) }, "API_SECRET validation failed at startup");
  }
}

const app = new Hono();

// CORS - Allow credentials for session cookies
app.use(
  "/*",
  cors({
    origin: (origin) => {
      // Allow requests from Next.js app or configured origins
      const allowedOrigins = [
        "http://localhost:3001", // Next.js dev
        "http://localhost:3000", // API itself
        process.env.CORS_ORIGIN,
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes("*")) {
        return origin || allowedOrigins[0];
      }

      return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie"],
    credentials: true, // Important: allow cookies
    exposeHeaders: ["Set-Cookie"],
  })
);

// Public routes (no authentication required)
// Rate limiting is applied to these routes only (protected routes have their own rate limiting via better-auth)

// Root endpoint
app.get("/", publicRateLimit, (c) => c.text("Openinary API Server is running."));

// Health check routes
app.use("/health", publicRateLimit);
app.use("/health/*", publicRateLimit);
app.route("/health", health);

// Original file download route (public — consistent with /t/)
app.use("/download", publicRateLimit);
app.use("/download/*", publicRateLimit);
app.route("/download", download);

// Transform routes (conditional — skip when DISABLE_TRANSFORMS=true to save ~50MB from sharp)
// ponytail: dynamic import avoids loading sharp/libvips entirely when transforms are disabled
if (!disableTransforms) {
  const [
    { default: transform },
    { default: authenticated },
    { default: videoStatus },
    { default: queueEvents },
    { default: queueModule },
  ] = await Promise.all([
    import("./routes/transform"),
    import("./routes/authenticated"),
    import("./routes/video-status"),
    import("./routes/queue-events"),
    import("./routes/queue"),
  ]);

  // Video status check (public - no auth required)
  app.use("/video-status", publicRateLimit);
  app.use("/video-status/*", publicRateLimit);
  app.route("/video-status", videoStatus);

  // Image transformation route is public for easy access to transformed images
  app.use("/t", publicRateLimit);
  app.use("/t/*", publicRateLimit);
  app.route("/t", transform);

  // Authenticated image transformation route (with signature verification)
  app.use("/authenticated", publicRateLimit);
  app.use("/authenticated/*", publicRateLimit);
  app.route("/authenticated", authenticated);

  // Queue events SSE endpoint (public for real-time updates)
  app.use("/queue/events", publicRateLimit);
  app.use("/queue/events/*", publicRateLimit);
  app.route("/queue/events", queueEvents);

  // Queue management routes (protected)
  app.use("/queue/*", apiKeyAuth);
  app.route("/queue", queueModule);
} else {
  // ponytail: serve raw files at /t/* — strips transform params, 302s to the original file
  app.get("/t/*", (c) => {
    const segments = c.req.path.split("/").slice(2);
    const fileSegments = segments.length > 0 && isTransformSegment(segments[0])
      ? segments.slice(1)
      : segments;
    const filePath = decodeURIComponent(fileSegments.join("/"))
      .replace(/\.\./g, "").replace(/\/+/g, "/").replace(/^\/+/, "");
    return filePath ? c.redirect(`/${filePath}`, 302) : c.text("File not found", 404);
  });
}

// Protected routes - require API key authentication
app.use("/upload/*", apiKeyAuth);
app.route("/upload", upload);

app.use("/storage/*", apiKeyAuth);
app.route("/storage", storageRoute);

// Cache invalidation and management routes (protected)
app.use("/invalidate/*", apiKeyAuth);
app.route("/invalidate", invalidateRoute);

app.use("/cache/*", apiKeyAuth);
app.route("/cache", cacheRoute);

// API key management routes (also protected)
app.route("/api-keys", apiKeys);

// User management routes (protected + admin check inside)
app.use("/users/*", apiKeyAuth);
app.route("/users", usersRoute);

// Config routes (protected)
app.use("/config/*", apiKeyAuth);
app.route("/config", configRoute);

// Catch-all: serve raw files at root path (e.g. /my-image.jpg)
app.use("/*", publicRateLimit);
app.get("/*", async (c) => {
  const rawFilePath = c.req.path.replace(/^\//, "");
  if (!rawFilePath) return c.text("Openinary API Server is running.", 200);

  const filePath = decodeURIComponent(rawFilePath).replace(/\.\./g, "").replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "");
  if (!filePath) return c.text("Invalid path", 400);

  const storage = createStorageClient();
  try {
    let buffer;
    if (storage) {
      try { buffer = await storage.downloadOriginal(filePath); } catch { return c.text("File not found", 404); }
    } else {
      const localPath = safePath("./public", filePath);
      if (!fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) return c.text("File not found", 404);
      buffer = fs.readFileSync(localPath);
    }
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const ctype: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", avif: "image/avif", gif: "image/gif", psd: "image/vnd.adobe.photoshop", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", flac: "audio/flac", aac: "audio/aac", m4a: "audio/mp4", zip: "application/zip", pdf: "application/pdf" };
    const contentType = ctype[ext] ?? "application/octet-stream";
    c.header("Content-Type", contentType);
    c.header("Content-Length", buffer.length.toString());
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Accept-Ranges", "bytes");

    const range = c.req.header("Range");
    if (range) {
      const match = range.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const end = match[2] ? parseInt(match[2], 10) : buffer.length - 1;
        const chunk = buffer.subarray(start, end + 1);
        c.header("Content-Range", `bytes ${start}-${end}/${buffer.length}`);
        c.header("Content-Length", chunk.length.toString());
        return c.body(new Uint8Array(chunk), 206);
      }
    }

    return c.body(new Uint8Array(buffer));
  } catch (error) {
    logger.error({ error: serializeError(error), filePath }, "Catch-all raw fetch failed");
    return c.text("Internal server error", 500);
  }
});

export default app;
