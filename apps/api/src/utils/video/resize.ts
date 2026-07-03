import type { TransformFunction } from './types';

/**
 * Apply resize transformation to a video
 * Supports multiple crop modes: fill, crop, fit, scale, pad
 */
export const applyResize: TransformFunction = (
  command,
  context
) => {
  const { resize, width, height, crop } = context.params;

  let w: number | undefined;
  let h: number | undefined;

  // Parse dimensions from resize parameter
  if (resize) {
    const [wStr, hStr] = resize.split('x');
    w = wStr ? parseInt(wStr, 10) : undefined;
    h = hStr ? parseInt(hStr, 10) : undefined;
  }

  // Individual width/height parameters take precedence
  if (width !== undefined) {
    w = typeof width === 'string' ? parseInt(width, 10) : width;
  }
  if (height !== undefined) {
    h = typeof height === 'string' ? parseInt(height, 10) : height;
  }

  // Skip if neither dimension is valid
  if ((!w || w <= 0) && (!h || h <= 0)) {
    return command;
  }

  const wStr = w && w > 0 ? String(w) : '-2';
  const hStr = h && h > 0 ? String(h) : '-2';

  // Apply resize based on crop mode
  if (crop === 'fill' || crop === 'crop') {
    const filter =
      `scale=${wStr}:${hStr}:force_original_aspect_ratio=increase,crop=${wStr}:${hStr}`;
    return command.videoFilters(filter);
  } else {
    return command.videoFilters(`scale=${wStr}:${hStr}`);
  }
};
