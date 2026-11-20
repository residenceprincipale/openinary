import { execFile } from "node:child_process";
import { mkdtemp, readFile, rmdir, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";
import type { VideoTransformParams } from "../../types";
import {
  AUDIO_FORMATS,
  contentTypeForFormat,
  isAudioExt,
} from "../../url/media-types";

const AUDIO_CODECS: Record<string, string> = {
  mp3: "libmp3lame",
  wav: "pcm_s16le",
  ogg: "libvorbis",
  flac: "flac",
  aac: "aac",
  m4a: "aac",
};

const TIMEOUT_MS = 120_000;

function run(cmd: ffmpeg.FfmpegCommand, outputPath: string, tmpDir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cmd.kill("SIGKILL");
      reject(new Error("Audio processing timeout"));
    }, TIMEOUT_MS);

    cmd
      .on("end", async () => {
        clearTimeout(timeout);
        try {
          const buffer = await readFile(outputPath);
          await unlink(outputPath).catch(() => {});
          await rmdir(tmpDir).catch(() => {});
          resolve(buffer);
        } catch (error) {
          reject(error);
        }
      })
      .on("error", (error) => {
        clearTimeout(timeout);
        reject(new Error(`Audio processing failed: ${error.message}`));
      })
      .run();
  });
}

const hasAudioStream = (inputPath: string): Promise<boolean> =>
  new Promise((resolve) => {
    ffmpeg.ffprobe(inputPath, (_error, metadata) => {
      resolve(
        metadata?.streams?.some((stream) => stream.codec_type === "audio") ??
          false,
      );
    });
  });

/** One second of silence, so extracting audio from a silent video still
 *  returns a playable file instead of failing. */
async function silentAudio(
  codec: string,
  outputPath: string,
  tmpDir: string,
): Promise<Buffer> {
  const acodec = codec === "copy" ? "libmp3lame" : codec;
  await new Promise<void>((resolve, reject) => {
    // fluent-ffmpeg rejects lavfi (it is a device, not a demuxer).
    execFile(
      "ffmpeg",
      [
        "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
        "-t", "1", "-acodec", acodec, "-y", outputPath,
      ],
      { timeout: TIMEOUT_MS },
      (error) => {
        if (error) reject(new Error(`Silent audio generation failed: ${error.message}`));
        else resolve();
      },
    );
  });
  const buffer = await readFile(outputPath);
  await unlink(outputPath).catch(() => {});
  await rmdir(tmpDir).catch(() => {});
  return buffer;
}

/**
 * Transcode an audio source, or extract the audio track of a video.
 * Parameters: format (f_), quality as kbps (q_), volume (v_), trim (so_/eo_).
 */
export async function transformAudio(
  inputPath: string,
  params: VideoTransformParams,
): Promise<{ buffer: Buffer; contentType: string }> {
  const sourceExt = inputPath.split(".").pop()?.toLowerCase() ?? "";
  const requested = params.format?.toLowerCase();
  const format =
    requested && AUDIO_FORMATS.has(requested)
      ? requested
      : isAudioExt(sourceExt)
        ? sourceExt
        : "mp3";

  const tmpDir = await mkdtemp(join(tmpdir(), "audio-"));
  const outputPath = join(tmpDir, `${randomUUID()}.${format}`);
  const codec = AUDIO_CODECS[format] ?? "copy";

  if (!(await hasAudioStream(inputPath))) {
    return {
      buffer: await silentAudio(codec, outputPath, tmpDir),
      contentType: contentTypeForFormat(format),
    };
  }

  let cmd = ffmpeg(inputPath).noVideo().output(outputPath).addOption("-threads", "4");

  if (params.startOffset !== undefined) {
    cmd = cmd.addOption("-ss", String(params.startOffset));
  }
  if (params.endOffset !== undefined) {
    cmd = cmd.addOption("-to", String(params.endOffset));
  }
  if (params.quality !== undefined && params.quality !== "auto") {
    const bitrate = parseInt(String(params.quality), 10);
    if (!Number.isNaN(bitrate)) cmd = cmd.audioBitrate(Math.min(bitrate, 320));
  }
  if (params.volume !== undefined) {
    cmd = cmd.addOption(
      "-filter:a",
      `volume=${Math.min(Math.max(Number(params.volume), 0), 100) / 100}`,
    );
  }
  if (codec !== "copy") cmd = cmd.audioCodec(codec);

  return {
    buffer: await run(cmd, outputPath, tmpDir),
    contentType: contentTypeForFormat(format),
  };
}
