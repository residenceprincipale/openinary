import type { TransformFunction } from './types';

export const applyTrimming: TransformFunction = (
  command,
  context
) => {
  if (context.isThumbnail) {
    return command;
  }

  let { startOffset, endOffset } = context.params;

  if (startOffset !== undefined && context.duration !== undefined) {
    startOffset = Math.max(0, Math.min(startOffset, context.duration - 0.5));
  }

  if (startOffset !== undefined && startOffset >= 0) {
    command = command.seekInput(startOffset);
  }

  // Calculate and apply duration if end offset is specified
  let durationSeconds: number | undefined;
  if (endOffset !== undefined && endOffset >= 0) {
    if (startOffset !== undefined && startOffset >= 0) {
      // Duration = endOffset - startOffset (trim between start and end)
      const diff = endOffset - startOffset;
      if (diff > 0) {
        durationSeconds = diff;
      }
    } else {
      // Only endOffset specified → interpret as "play first endOffset seconds"
      durationSeconds = endOffset;
    }
  }

  // Apply duration if calculated
  if (durationSeconds !== undefined && durationSeconds > 0) {
    command = command.duration(durationSeconds);
  }

  return command;
};
