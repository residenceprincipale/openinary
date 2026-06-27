import { Hono } from "hono";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { apiKeyAuth } from "../middleware/auth";
import { createStorageClient } from "../utils/storage/factory";
import logger, { serializeError } from "../utils/logger";

const CONFIG_PATH = join(process.cwd(), "data", "transforms.json");

const defaults = {
  image: { quality: 80, format: "auto", crop: "fill", gravity: "center" },
  video: { quality: 60, format: "mp4", autoDownscale: true, autoDownscaleResolution: 720 },
  audio: { quality: 192, format: "mp3", sampleRate: "44100", channels: "stereo" },
  branding: { title: "Openinary", logoUrl: "" },
};

function readConfig(): typeof defaults {
  try {
    if (existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return {
        image: { ...defaults.image, ...(saved.image || {}) },
        video: { ...defaults.video, ...(saved.video || {}) },
        audio: { ...defaults.audio, ...(saved.audio || {}) },
        branding: { ...defaults.branding, ...(saved.branding || {}) },
      };
    }
  } catch {
    logger.warn("Failed to read config, using defaults");
  }
  return defaults;
}

const config = new Hono();

config.use("/*", apiKeyAuth);

config.get("/transforms", (c) => {
  return c.json({ success: true, data: readConfig() });
});

function getLocalStorageUsed(): number {
  const dir = "./public";
  if (!existsSync(dir)) return 0;
  let total = 0;
  const walk = (p: string) => {
    for (const entry of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) total += statSync(full).size;
    }
  };
  walk(dir);
  return total;
}

config.get("/server", async (c) => {
  const storageLimitMB = parseInt(process.env.STORAGE_LIMIT_MB ?? "0", 10) || 0;
  const storage = createStorageClient();
  const usedBytes = storage ? await storage.getTotalSize() : getLocalStorageUsed();

  return c.json({
    success: true,
    data: {
      maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB ?? "50", 10) || 50,
      storageLimitMB,
      storageUsedMB: Math.round(usedBytes / (1024 * 1024) * 100) / 100,
    },
  });
});

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
    const dir = join(process.cwd(), "data");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
    logger.info({ config: merged }, "Transform defaults updated");
    return c.json({ success: true, data: merged });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to update config");
    return c.json({ success: false, error: "Failed to save config" }, 500);
  }
});

export default config;
