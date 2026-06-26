import { Hono } from "hono";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { apiKeyAuth } from "../middleware/auth";
import logger, { serializeError } from "../utils/logger";

const CONFIG_PATH = join(process.cwd(), "data", "transforms.json");

const defaults = {
  image: { quality: 80, format: "auto", crop: "fill", gravity: "center" },
  video: { quality: 60, format: "mp4", autoDownscale: true, autoDownscaleResolution: 720 },
  branding: { title: "Openinary", logoUrl: "" },
};

function readConfig(): typeof defaults {
  try {
    if (existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return {
        image: { ...defaults.image, ...(saved.image || {}) },
        video: { ...defaults.video, ...(saved.video || {}) },
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

config.put("/transforms", async (c) => {
  try {
    const body = await c.req.json();
    const current = readConfig();
    const merged = {
      image: { ...current.image, ...body.image },
      video: { ...current.video, ...body.video },
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
