import type { TransformFunction } from './types';
import { getDefaults } from '../transform-defaults';

export const applyQuality: TransformFunction = (
  command,
  context
) => {
  if (context.isThumbnail) {
    return command;
  }

  const { quality, volume } = context.params;
  const cfg = (getDefaults().video || {}) as { quality?: number };
  const defaultQuality = cfg.quality ?? 60;
  const qualityValue = quality !== undefined
    ? (typeof quality === 'string' ? parseInt(quality, 10) : quality)
    : defaultQuality;

  // Validate quality range (0-100)
  if (isNaN(qualityValue) || qualityValue < 0 || qualityValue > 100) {
    const crf = Math.round(51 - (defaultQuality / 100) * 33);
    return command
      .videoCodec('libx264')
      .addOption('-preset', 'ultrafast')
      .addOption('-crf', crf.toString())
      .audioCodec(volume !== undefined ? 'aac' : 'copy');
  }

  const crf = Math.round(51 - (qualityValue / 100) * 33);

  return command
    .videoCodec('libx264')
    .addOption('-preset', 'ultrafast')
    .addOption('-crf', crf.toString())
    .addOption('-tune', 'fastdecode')
    .addOption('-profile:v', 'baseline')
    .addOption('-level', '3.0')
    .audioCodec(volume !== undefined ? 'aac' : 'copy');
};
