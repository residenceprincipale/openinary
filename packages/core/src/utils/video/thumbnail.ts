import type { TransformFunction } from "./types";

/**
 * Apply thumbnail extraction transformation
 * Extracts a single frame from the video at the specified time
 */
export const applyThumbnailExtraction: TransformFunction = (
  command,
  outputVideoStream,
  context,
) => {
  if (!context.isThumbnail) {
    return;
  }

  // Determine the time to extract the thumbnail from
  // Priority: thumbnailTime > startOffset > 0
  const rawTime = context.params.thumbnailTime ?? context.params.startOffset ?? 0;

  // Clamp inside the video: seeking past the end returns no frame, and the
  // last half second can decode to black on poorly-cut files.
  const time = Math.max(0, Math.min(rawTime, (context.duration ?? Infinity) - 0.5));

  // Seek to the specified time and extract a single frame.
  // Do NOT force "-f image2" here: ffmpeg infers the correct muxer from the
  // output file extension (e.g. .webp → webp muxer, .png → png muxer).
  // Forcing image2 would override that and break webp/avif/png output.
  return { command: command.seekInput(time).frames(1) };
};
