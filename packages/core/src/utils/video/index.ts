import { mkdtemp, rmdir, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import type { TransformDefaults, VideoTransformParams } from "../../types";
import {
  determineOutputFormat,
  IMAGE_FORMATS,
  normalizeFormat,
} from "../../url/media-types";
import { applyThumbnailExtraction } from "./thumbnail";
import { applyTrimming } from "./trim";
import { applyAutoDownscale } from "./auto-downscale";
import { applyResize } from "./resize";
import { applyQuality } from "./quality";
import { applyVolume } from "./volume";
import { VideoCommandBuilder, type EncodeProgress } from "./command-builder";
import type { VideoContext } from "./types";
import { applyOverlay } from "./overlay";
import { stageSource, type StagedSource } from "../stage-source";
import type { CloudStorage } from "../storage";
import type { EnginePaths } from "../../config/paths";
import type { VideoSettings } from "./config";

// Re-export types for backward compatibility
export * from "./types";
export * from "./video-info";
export type { EncodeProgress } from "./command-builder";

/**
 * Image formats that ffmpeg cannot encode natively in all builds.
 * For these we extract a JPEG frame via ffmpeg, then convert with sharp.
 * This decouples thumbnail quality from ffmpeg's build flags (e.g. libwebp).
 */
const SHARP_CONVERTED_FORMATS = new Set(["webp", "avif", "png", "gif"]);

/**
 * Convert an image buffer to the target format using sharp.
 * Falls back to the original buffer on any sharp error.
 */
async function convertWithSharp(
  buffer: Buffer,
  targetFormat: string,
  quality?: number,
): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const q = quality !== undefined ? Math.round(quality) : 80;

  switch (targetFormat) {
    case "webp":
      return sharp(buffer).webp({ quality: q }).toBuffer();
    case "avif":
      return sharp(buffer).avif({ quality: q }).toBuffer();
    case "png":
      return sharp(buffer).png().toBuffer();
    case "gif":
      // sharp doesn't encode animated GIF well; best effort single frame
      return sharp(buffer).gif().toBuffer();
    default:
      return buffer;
  }
}

/**
 * Transform a video with the specified parameters.
 *
 * Supports:
 * - Video transformations (resize, quality, trim)
 * - Thumbnail extraction (single frame as image)
 * - Format conversion (mp4, mov, webm, jpg, png, webp, avif, …)
 * - Auto-downscales to 720p max (unless explicit resize specified)
 * - Default compression quality of 60/100 (CRF 31), optimised for 8K
 * - Ultra-fast encoding preset with baseline profile for minimal CPU usage
 * - Audio copied without re-encoding
 * - 5-minute timeout protection (accommodates 8K videos)
 *
 * Thumbnail pipeline detail:
 *   1. ffmpeg seeks to tt_N and extracts one JPEG frame (universal support).
 *   2. If the requested format needs sharp (webp, avif, png, gif), the JPEG
 *      buffer is post-processed by sharp, this avoids relying on optional
 *      ffmpeg build flags such as libwebp.
 */
type VideoRun = {
  storage: CloudStorage | null;
  paths: EnginePaths;
  settings: VideoSettings;
  defaults?: TransformDefaults;
};

type PipelineResult =
  | { buffer: Buffer; outputPath?: undefined; cleanup?: undefined }
  | { buffer?: undefined; outputPath: string; cleanup: () => Promise<void> };

/** Shared pipeline: ffmpeg writes one file, and the caller decides whether to
 *  read it into memory (thumbnails) or stream it to storage (video worker). */
async function runVideoPipeline(
  inputPath: string,
  params: VideoTransformParams,
  run: VideoRun,
  onProgress: ((progress: EncodeProgress) => void) | undefined,
  keepOutput: boolean,
): Promise<PipelineResult> {
  const tmpDir = await mkdtemp(join(tmpdir(), "video-"));
  const sourceExt = inputPath.split(".").pop()?.toLowerCase();

  const { format, isImageOutput, isThumbnail } = determineOutputFormat(
    sourceExt,
    params.format,
  );

  const ffmpegFormat = isThumbnail ? "jpg" : format;
  const needsSharpConversion =
    isThumbnail &&
    IMAGE_FORMATS.has(normalizeFormat(format)) &&
    SHARP_CONVERTED_FORMATS.has(normalizeFormat(format));

  const outputPath = join(tmpDir, `${randomUUID()}.${ffmpegFormat}`);

  let duration: number | undefined;
  if (isThumbnail) {
    try {
      const { getVideoInfo } = await import("./video-info");
      duration = (await getVideoInfo(inputPath)).duration;
    } catch {
      // Non-fatal: fall back to seeking the requested time.
    }
  }

  const context: VideoContext = {
    inputPath,
    outputPath,
    tmpDir,
    params: { ...params },
    isImageOutput,
    isThumbnail,
    duration,
    defaults: run.defaults,
  };

  let overlay: StagedSource | undefined;
  let completed = false;

  try {
    if (context.params.overlayPath) {
      overlay = await stageSource(run.storage, run.paths, context.params.overlayPath);
      context.params.overlayPath = overlay.path;
    }

    const builder = new VideoCommandBuilder(context, run.settings);
    await builder.apply(
      applyThumbnailExtraction,
      applyTrimming,
      applyAutoDownscale,
      applyResize,
      applyOverlay,
      applyQuality,
      // After quality: its audioCodec("copy") would drop the filter.
      applyVolume,
    );

    if (keepOutput) {
      const filePath = await builder.executeToFile(onProgress);
      completed = true;
      return {
        outputPath: filePath,
        cleanup: async () => {
          await unlink(filePath).catch(() => {});
          try {
            await rmdir(tmpDir);
          } catch {
            // Already gone or a staged overlay still lives there.
          }
        },
      };
    }

    let buffer = await builder.execute(onProgress);

    if (needsSharpConversion) {
      const qualityValue =
        params.quality !== undefined
          ? typeof params.quality === "string"
            ? parseInt(params.quality, 10)
            : params.quality
          : 80;
      buffer = await convertWithSharp(
        buffer,
        normalizeFormat(format),
        qualityValue,
      );
    }

    completed = true;
    return { buffer };
  } finally {
    await overlay?.cleanup();
    if (!completed) {
      await unlink(outputPath).catch(() => {});
      try {
        await rmdir(tmpDir);
      } catch {
        // Already gone.
      }
    }
  }
}

export const transformVideo = async (
  inputPath: string,
  params: VideoTransformParams,
  run: VideoRun,
  onProgress?: (progress: EncodeProgress) => void,
): Promise<Buffer> => {
  const result = await runVideoPipeline(inputPath, params, run, onProgress, false);
  return result.buffer!;
};

/**
 * Encodes a video to a temporary file and lets the caller stream it to its
 * destination. The 300 MB buffer of a large transcode never enters the heap.
 * `cleanup()` removes the file and its temp directory; call it after upload.
 */
export const transformVideoToFile = async (
  inputPath: string,
  params: VideoTransformParams,
  run: VideoRun,
  onProgress?: (progress: EncodeProgress) => void,
): Promise<{ filePath: string; cleanup: () => Promise<void> }> => {
  const result = await runVideoPipeline(inputPath, params, run, onProgress, true);
  return { filePath: result.outputPath!, cleanup: result.cleanup! };
};
