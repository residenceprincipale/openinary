import type { TransformFunction } from './types';

/**
 * Apply thumbnail extraction transformation
 * Extracts a single frame from the video at the specified time
 * Clamps to video duration to avoid seeking past the end (which yields 0 frames)
 */
export const applyThumbnailExtraction: TransformFunction = (
  command,
  context
) => {
  if (!context.isThumbnail) {
    return command;
  }

  const duration = context.duration ?? Infinity;

  // Determine the time to extract the thumbnail from
  // Priority: thumbnailTime > startOffset > 0
  const rawTime = 
    context.params.thumbnailTime ?? 
    context.params.startOffset ?? 
    0;

  // Clamp to a safe position within the video (at least 0.5s from end so we
  // don't hit a black frame on poorly-clipped files, at least 0s)
  const time = Math.max(0, Math.min(rawTime, duration - 0.5));

  return command
    .seekInput(time)
    .frames(1);
};
