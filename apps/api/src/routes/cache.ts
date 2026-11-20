import { Hono } from "hono";
import { promises as fs } from "fs";
import { basename, join } from "path";
import {
  clearAllCache,
  getCacheSize,
  listCachedFiles,
  logger,
  serializeError,
} from "@openinary/core/light";
import { apiKeyAuth, type AuthVariables } from "../middleware/auth";
import { getSharedStorage } from "../config/storage";
import { enginePaths } from "../config/paths";

const cacheRoute = new Hono<AuthVariables>();
cacheRoute.use("/*", apiKeyAuth);
// Clearing the cache slows the next requests for everyone: admins only.
cacheRoute.use("/*", async (c, next) => {
  if (c.req.method === "DELETE" && c.get("user")?.role !== "admin") {
    return c.json({ success: false, error: "Admin access required" }, 403);
  }
  await next();
});

cacheRoute.get("/stats", async (c) => {
  const localFiles = await listCachedFiles(enginePaths.cache);
  const local = await getCacheSize(enginePaths.cache);

  const storage = getSharedStorage();
  const cloudFiles = storage ? await storage.listAllCachedTransformations() : null;

  return c.json({
    success: true,
    data: {
      local: {
        totalFiles: local.fileCount,
        totalSize: local.size,
        files: localFiles,
      },
      cloud: cloudFiles
        ? {
            enabled: true,
            totalFiles: cloudFiles.length,
            totalSize: cloudFiles.reduce((sum, f) => sum + f.size, 0),
            files: cloudFiles,
          }
        : { enabled: false, totalFiles: 0, totalSize: 0, files: [] },
    },
  });
});

cacheRoute.delete("/", async (c) => {
  const storage = getSharedStorage();
  const [localDeleted, cloudDeleted] = await Promise.all([
    clearAllCache(enginePaths.cache),
    storage ? storage.clearAllCache() : Promise.resolve(0),
  ]);
  return c.json({ success: true, data: { localDeleted, cloudDeleted } });
});

cacheRoute.delete("/cloud/*", async (c) => {
  const key = c.req.param("*");
  if (!key) return c.json({ success: false, error: "Key required" }, 400);

  const storage = getSharedStorage();
  if (!storage) {
    return c.json({ success: false, error: "Cloud storage not configured" }, 400);
  }
  try {
    await storage.deleteCachedTransformation(key);
    return c.json({ success: true, data: { deleted: key } });
  } catch (error) {
    logger.error({ error: serializeError(error), key }, "Failed to delete cloud cache entry");
    return c.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});

cacheRoute.delete("/old", async (c) => {
  const age = parseInt(c.req.query("age") || String(7 * 24 * 60 * 60 * 1000), 10);
  const cutoff = Date.now() - age;

  const files = await listCachedFiles(enginePaths.cache);
  let deletedCount = 0;
  for (const file of files) {
    if (file.lastModified.getTime() >= cutoff) continue;
    try {
      await fs.unlink(join(enginePaths.cache, file.name));
      deletedCount++;
    } catch (error) {
      logger.warn({ error: serializeError(error), file: file.name }, "Failed to delete old cache file");
    }
  }

  return c.json({ success: true, data: { deletedCount, cutoffAge: age } });
});

cacheRoute.delete("/:name", async (c) => {
  const name = basename(c.req.param("name"));
  if (!name) return c.json({ success: false, error: "File name required" }, 400);

  try {
    await fs.unlink(join(enginePaths.cache, name));
    return c.json({ success: true, data: { deleted: name } });
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return c.json(
      { success: false, error: missing ? "File not found" : "Failed to delete file" },
      missing ? 404 : 500,
    );
  }
});

export default cacheRoute;
