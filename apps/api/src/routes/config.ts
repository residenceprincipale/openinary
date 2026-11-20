import { Hono } from "hono";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { getBucketStats, logger, serializeError } from "@openinary/core";
import { apiKeyAuth, type AuthVariables } from "../middleware/auth";
import { getSharedStorage } from "../config/storage";
import { enginePaths } from "../config/queue";
import { readConfig, writeConfig } from "../utils/transform-defaults";

const config = new Hono<AuthVariables>();
config.use("/*", apiKeyAuth);

/** Bytes held by the originals when no bucket is configured. */
function localStorageUsed(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  const walk = (path: string) => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += statSync(full).size;
    }
  };
  walk(dir);
  return total;
}

config.get("/transforms", (c) => c.json({ success: true, data: readConfig() }));

config.put("/transforms", async (c) => {
  try {
    const body = await c.req.json();
    const current = readConfig();
    const merged = {
      image: { ...current.image, ...body.image },
      video: { ...current.video, ...body.video },
      audio: { ...current.audio, ...body.audio },
      branding: { ...current.branding, ...body.branding },
    };
    writeConfig(merged);
    logger.info({ config: merged }, "Transform defaults updated");
    return c.json({ success: true, data: merged });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to update config");
    return c.json({ success: false, error: "Failed to save config" }, 500);
  }
});

config.get("/server", async (c) => {
  const storage = getSharedStorage();
  const usedBytes = storage
    ? (await getBucketStats(storage)).storage.size
    : localStorageUsed(enginePaths.public);

  return c.json({
    success: true,
    data: {
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB ?? "50", 10) || 50,
      storageLimitMB: parseInt(process.env.STORAGE_LIMIT_MB ?? "0", 10) || 0,
      storageUsedMB: Math.round((usedBytes / (1024 * 1024)) * 100) / 100,
    },
  });
});

export default config;
