import type { TransformFunction } from './types';

export const applyThumbnailExtraction: TransformFunction = (
  command,
  context
) => {
  if (!context.isThumbnail) {
    return command;
  }

  const duration = context.duration ?? Infinity;
  const rawTime = context.params.startOffset ?? 0;
  const time = Math.max(0, Math.min(rawTime, duration - 0.5));

  // ponytail: seekOutput (frame-accurate) over seekInput (keyframe) —
  // seekInput + h264 Main + mjpeg produces 0 frames on ffmpeg 5.x Debian
  return command.seekOutput(time).frames(1);
};
