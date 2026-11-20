import { Hono } from "hono";
import type { RouteDeps } from "../config/deps";
import { zipSync } from "fflate";
import fs from "fs";
import path from "path";
import logger, { serializeError } from "../utils/logger";
import { pathBelowMount } from "./delivery";
import { cleanStorageKey } from "../url/storage-layout";

function collectLocalFiles(
  dir: string,
  base: string,
): { arcPath: string; fullPath: string }[] {
  const results: { arcPath: string; fullPath: string }[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.join(base, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectLocalFiles(full, rel));
    } else {
      results.push({ arcPath: rel.replace(/\\/g, "/"), fullPath: full });
    }
  }
  return results;
}

const MAX_ZIP_BYTES =
  (parseInt(process.env.MAX_ZIP_MB ?? "2048", 10) || 2048) * 1024 * 1024;

export function createDownloadFolderRoute(deps: RouteDeps) {
  const { storage, paths } = deps;
  const downloadFolder = new Hono();

  /**
   * GET /download-folder/:path
   * Returns all files under the given folder path as a ZIP archive.
   */
  downloadFolder.get("/*", async (c) => {
    const rawFolderPath = pathBelowMount(c);

    if (!rawFolderPath) {
      return c.text("Folder path is required", 400);
    }

    const folderPath = cleanStorageKey(rawFolderPath);

    if (!folderPath) {
      return c.text("Invalid folder path", 400);
    }

    const folderName = folderPath.split("/").pop() ?? folderPath;

    try {
      const zipFiles: Record<string, Uint8Array> = {};

      if (storage) {
        const prefix = storage.mediaKey(`${folderPath}/`);
        const objects = await storage.list(prefix);

        if (objects.length === 0) {
          return c.text("Folder not found or empty", 404);
        }

        const totalBytes = objects.reduce((sum, obj) => sum + (obj.size ?? 0), 0);
        if (totalBytes > MAX_ZIP_BYTES) {
          return c.text(
            `Folder is too large to zip (${Math.round(totalBytes / 1024 / 1024)} MB, max ${MAX_ZIP_BYTES / 1024 / 1024} MB). Download its files individually.`,
            413,
          );
        }

        // One file at a time: the zip still lives in memory, but the peak is
        // the folder size instead of twice it in parallel buffers.
        for (const obj of objects) {
          // obj.key looks like "<mediaPrefix>videos/clip.mp4"
          const relPath = obj.key.replace(prefix, "");
          // Skip folder marker objects (empty keys or keys ending in /)
          if (!relPath || relPath.endsWith("/")) continue;

          const buffer = await storage.downloadOriginal(
            `${folderPath}/${relPath}`,
          );
          zipFiles[relPath] = new Uint8Array(buffer);
        }
      } else {
        const localDir = path.join(paths.public, folderPath);
        if (!fs.existsSync(localDir) || !fs.statSync(localDir).isDirectory()) {
          return c.text("Folder not found", 404);
        }

        const entries = collectLocalFiles(localDir, "");
        if (entries.length === 0) {
          return c.text("Folder is empty", 404);
        }

        const totalBytes = entries.reduce((sum, entry) => {
          try {
            return sum + fs.statSync(entry.fullPath).size;
          } catch {
            return sum;
          }
        }, 0);
        if (totalBytes > MAX_ZIP_BYTES) {
          return c.text(
            `Folder is too large to zip (${Math.round(totalBytes / 1024 / 1024)} MB, max ${MAX_ZIP_BYTES / 1024 / 1024} MB). Download its files individually.`,
            413,
          );
        }

        for (const entry of entries) {
          zipFiles[entry.arcPath] = new Uint8Array(
            fs.readFileSync(entry.fullPath),
          );
        }
      }

      if (Object.keys(zipFiles).length === 0) {
        return c.text("Folder is empty", 404);
      }

      const zipBuffer = zipSync(zipFiles);

      c.header("Content-Type", "application/zip");
      c.header(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(folderName)}.zip"`,
      );
      c.header("Content-Length", zipBuffer.length.toString());
      c.header("Cache-Control", "private, no-store");
      return c.body(zipBuffer);
    } catch (error) {
      logger.error(
        { error: serializeError(error), folderPath },
        "Folder download failed",
      );
      return c.text("Internal server error", 500);
    }
  });

  return downloadFolder;
}
