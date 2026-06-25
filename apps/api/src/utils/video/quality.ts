import type { TransformFunction } from './types';
import { getDefaults } from '../transform-defaults';

export const applyQuality: TransformFunction = (
  command,
  context
) => {
  if (context.isThumbnail) {
    return command;
  }

  const { quality } = context.params;
  const cfg = (getDefaults().video || {}) as { quality?: number };
  const defaultQuality = cfg.quality ?? 60;
  const qualityValue = quality !== undefined
    ? (typeof quality === 'string' ? parseInt(quality, 10) : quality)
    : defaultQuality;

  // Validate quality range (0-100)
  if (isNaN(qualityValue) || qualityValue < 0 || qualityValue > 100) {
    // Use default if invalid
    const crf = Math.round(51 - (defaultQuality / 100) * 33);
    return command
      .videoCodec('libx264')
      .addOption('-preset', 'ultrafast')  // Ultra fast preset for local dev
      .addOption('-crf', crf.toString())
      .audioCodec('copy');  // Copy audio without re-encoding
  }

  // Convert quality (0-100) to CRF (51-0)
  // Higher quality = lower CRF
  const crf = Math.round(51 - (qualityValue / 100) * 33);

  return command
    .videoCodec('libx264')
    .addOption('-preset', 'ultrafast')
    .addOption('-crf', crf.toString())
    .addOption('-tune', 'fastdecode')    // Optimize for fast decoding
    .addOption('-profile:v', 'baseline') // Use baseline profile for compatibility & speed
    .addOption('-level', '3.0')          // Lower level = simpler encoding
    .audioCodec('copy');  // Copy audio without re-encoding
};
