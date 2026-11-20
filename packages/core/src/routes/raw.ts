import { Hono } from "hono";
import type { RouteDeps } from "../config/deps";
import { pathBelowMount } from "./delivery";
import { cleanStorageKey } from "../url/storage-layout";
import { serveOriginal } from "./original-response";
import logger, { serializeError } from "../utils/logger";

/**
 * Originals at the root (`/photos/a.jpg`), inline and range-capable, so a
 * stored file has a stable public URL even when transforms are off. Mounted
 * last: every API route above wins.
 */
export function createRawRoute(deps: RouteDeps) {
  const raw = new Hono();

  raw.on(["GET", "HEAD"], "/*", async (c) => {
    const filePath = cleanStorageKey(pathBelowMount(c));
    if (!filePath) {
      return c.text("Invalid file path", 400);
    }

    return serveOriginal(c, deps, filePath, {
      disposition: "inline",
      cacheControl: "public, max-age=3600",
    });
  });

  raw.onError((error, c) => {
    logger.error({ error: serializeError(error), path: c.req.path }, "Raw delivery failed");
    return c.text("Internal server error", 500);
  });

  return raw;
}
