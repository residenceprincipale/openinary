import { Hono } from "hono";
import type { RouteDeps } from "../config/deps";
import fs from "fs";
import path from "path";
import logger, { serializeError } from "../utils/logger";
import { pathBelowMount } from "./delivery";
import { cleanStorageKey } from "../url/storage-layout";
import { contentTypeForExt } from "../url/media-types";

/** "bytes=0-1023" -> [0, 1023], clamped to the file. Null when unsatisfiable. */
function parseRange(
  header: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  if (rawStart === "" && rawEnd === "") return null;

  if (rawStart === "") {
    // bytes=-N: the last N bytes
    const suffix = parseInt(rawEnd, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = parseInt(rawStart, 10);
  const end = rawEnd === "" ? size - 1 : parseInt(rawEnd, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= size || start > end) return null;
  return { start, end: Math.min(end, size - 1) };
}

/**
 * Originals at the root (`/photos/a.jpg`), inline and range-capable, so a
 * stored file has a stable public URL even when transforms are off. Mounted
 * last: every API route above wins.
 */
export function createRawRoute(deps: RouteDeps) {
  const { storage, paths } = deps;
  const raw = new Hono();

  raw.on(["GET", "HEAD"], "/*", async (c) => {
    const filePath = cleanStorageKey(pathBelowMount(c));
    if (!filePath) {
      return c.text("Invalid file path", 400);
    }

    let buffer: Buffer;
    try {
      if (storage) {
        buffer = await storage.downloadOriginal(filePath);
      } else {
        const absolute = path.join(paths.public, filePath);
        if (!fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
          return c.text("File not found", 404);
        }
        buffer = fs.readFileSync(absolute);
      }
    } catch {
      return c.text("File not found", 404);
    }

    const size = buffer.length;
    const ext = path.extname(filePath).slice(1).toLowerCase();
    c.header("Accept-Ranges", "bytes");
    c.header("Content-Type", contentTypeForExt(ext));
    c.header("Content-Disposition", "inline");
    c.header("Cache-Control", "public, max-age=3600");

    const range = c.req.header("range");
    if (!range) {
      c.header("Content-Length", size.toString());
      if (c.req.method === "HEAD") return c.body(null, 200);
      return c.body(new Uint8Array(buffer), 200);
    }

    const parsed = parseRange(range, size);
    if (!parsed) {
      c.header("Content-Range", `bytes */${size}`);
      return c.body(null, 416);
    }

    const { start, end } = parsed;
    c.header("Content-Range", `bytes ${start}-${end}/${size}`);
    c.header("Content-Length", (end - start + 1).toString());
    if (c.req.method === "HEAD") return c.body(null, 206);
    return c.body(new Uint8Array(buffer.subarray(start, end + 1)), 206);
  });

  raw.onError((error, c) => {
    logger.error({ error: serializeError(error), path: c.req.path }, "Raw delivery failed");
    return c.text("Internal server error", 500);
  });

  return raw;
}
