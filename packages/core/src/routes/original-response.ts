import type { Context } from "hono";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import type { RouteDeps } from "../config/deps";
import { contentTypeForExt } from "../url/media-types";
import { parseRange } from "../utils/range";
import logger, { serializeError } from "../utils/logger";

/**
 * Serves a stored original without buffering it: local files are read as a
 * stream, bucket objects are proxied from S3. Range requests are honoured on
 * both, so a video can be scrubbed before it has finished downloading.
 */
export async function serveOriginal(
  c: Context,
  deps: RouteDeps,
  filePath: string,
  options: {
    disposition: "inline" | "attachment";
    cacheControl: string;
  },
): Promise<Response> {
  const { storage, paths } = deps;
  const filename = path.basename(filePath);
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const isHead = c.req.method === "HEAD";
  const rangeHeader = c.req.header("range");

  let totalSize: number;
  let length: number;
  let stream: ReadableStream<Uint8Array> | undefined;
  let contentRange: string | undefined;
  let status: 200 | 206 = 200;

  try {
    if (storage) {
      // One HEAD, needed for Content-Length and to clamp the range.
      const metadata = await storage.getOriginalMetadata(filePath);
      if (!metadata) return c.text("File not found", 404);
      totalSize = metadata.size;

      if (rangeHeader) {
        const parsed = parseRange(rangeHeader, totalSize);
        if (!parsed) {
          c.header("Content-Range", `bytes */${totalSize}`);
          return c.body(null, 416);
        }
        status = 206;
        length = parsed.end - parsed.start + 1;
        contentRange = `bytes ${parsed.start}-${parsed.end}/${totalSize}`;
        if (!isHead) {
          const result = await storage.downloadOriginalStream(
            filePath,
            `bytes=${parsed.start}-${parsed.end}`,
          );
          stream = result.stream;
          if (result.contentRange) contentRange = result.contentRange;
          if (result.contentLength) length = result.contentLength;
        }
      } else {
        length = totalSize;
        if (!isHead) {
          const result = await storage.downloadOriginalStream(filePath);
          stream = result.stream;
          if (result.contentLength) length = result.contentLength;
        }
      }
    } else {
      const absolute = path.join(paths.public, filePath);
      const stats = await stat(absolute).catch(() => null);
      if (!stats || stats.isDirectory()) {
        return c.text("File not found", 404);
      }
      totalSize = stats.size;

      if (rangeHeader) {
        const parsed = parseRange(rangeHeader, totalSize);
        if (!parsed) {
          c.header("Content-Range", `bytes */${totalSize}`);
          return c.body(null, 416);
        }
        status = 206;
        length = parsed.end - parsed.start + 1;
        contentRange = `bytes ${parsed.start}-${parsed.end}/${totalSize}`;
        if (!isHead) {
          stream = Readable.toWeb(
            createReadStream(absolute, {
              start: parsed.start,
              end: parsed.end,
            }),
          ) as ReadableStream<Uint8Array>;
        }
      } else {
        length = totalSize;
        if (!isHead) {
          stream = Readable.toWeb(
            createReadStream(absolute),
          ) as ReadableStream<Uint8Array>;
        }
      }
    }
  } catch (error) {
    logger.error(
      { error: serializeError(error), filePath },
      "Failed to stream original",
    );
    return c.text("File not found", 404);
  }

  c.header("Accept-Ranges", "bytes");
  c.header("Content-Type", contentTypeForExt(ext));
  c.header("Cache-Control", options.cacheControl);
  c.header("Content-Length", length.toString());
  if (contentRange) c.header("Content-Range", contentRange);

  if (options.disposition === "attachment") {
    c.header(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
  } else {
    c.header("Content-Disposition", "inline");
  }

  if (isHead) return c.newResponse(null, status);
  if (!stream) return c.text("File not found", 404);
  return c.body(stream, status);
}
