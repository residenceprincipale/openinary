import type { TransformFunction } from './types';
import { getDefaults } from '../transform-defaults';

export const applyAutoDownscale: TransformFunction = (
  command,
  context
) => {
  if (context.isThumbnail) {
    return command;
  }

  const { resize, width, height } = context.params;

  if (resize || width !== undefined || height !== undefined) {
    return command;
  }

  const cfg = (getDefaults().video || {}) as { autoDownscale?: boolean; autoDownscaleResolution?: number };
  if (cfg.autoDownscale === false) {
    return command;
  }

  const res = cfg.autoDownscaleResolution || 720;
  const filter = `scale='min(${res * 2},iw)':'min(${res},ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2`;
  return command.videoFilters(filter);
};