import { Hono } from "hono";
import { createStorageClient } from "../utils/storage/index";
import fs from "fs";
import path from "path";
import logger, { serializeError } from "../utils/logger";

const raw = new Hono();
const storage = createStorageClient();

raw.get("/*", async (c) => {
  const rawFilePath = c.req.path.replace(/^\/raw\/?/, "");

  if (!rawFilePath) {
    return c.text("File path is required", 400);
  }

  let filePath: string;
  try {
    filePath = decodeURIComponent(rawFilePath)
      .replace(/\.\./g, "")
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\/+/, "");
  } catch {
    return c.text("Invalid file path", 400);
  }

  if (!filePath) {
    return c.text("Invalid file path", 400);
  }

  const filename = path.basename(filePath);

  try {
    let buffer: Buffer;

    if (storage) {
      try {
        buffer = await storage.downloadOriginal(filePath);
      } catch {
        return c.text("File not found", 404);
      }
    } else {
      const localPath = path.join("./public", filePath);
      if (!fs.existsSync(localPath) || fs.statSync(localPath).isDirectory()) {
        return c.text("File not found", 404);
      }
      buffer = fs.readFileSync(localPath);
    }

    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const contentTypeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", avif: "image/avif", gif: "image/gif",
      psd: "image/vnd.adobe.photoshop",
      mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
      mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
      flac: "audio/flac", aac: "audio/aac", m4a: "audio/mp4",
      zip: "application/zip", pdf: "application/pdf",
    };
    const contentType = contentTypeMap[ext] ?? "application/octet-stream";

    c.header("Content-Type", contentType);
    c.header("Content-Length", buffer.length.toString());
    c.header("Cache-Control", "public, max-age=31536000, immutable");
    return c.body(new Uint8Array(buffer));
  } catch (error) {
    logger.error({ error: serializeError(error), filePath }, "Raw fetch failed");
    return c.text("Internal server error", 500);
  }
});

export default raw;
