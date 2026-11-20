import { Hono } from "hono";
import type { RouteDeps } from "../config/deps";
import { pathBelowMount } from "./delivery";
import { cleanStorageKey } from "../url/storage-layout";
import { serveOriginal } from "./original-response";

export function createDownloadRoute(deps: RouteDeps) {
  const download = new Hono();

  /**
   * GET /download/:path
   * Streams the original stored file as an attachment, with Range support.
   * Public route, consistent with /t/* which is also public.
   */
  download.on(["GET", "HEAD"], "/*", async (c) => {
    const rawFilePath = pathBelowMount(c);

    if (!rawFilePath) {
      return c.text("File path is required", 400);
    }

    const filePath = cleanStorageKey(rawFilePath);

    if (!filePath) {
      return c.text("Invalid file path", 400);
    }

    return serveOriginal(c, deps, filePath, {
      disposition: "attachment",
      cacheControl: "private, no-store",
    });
  });

  return download;
}
