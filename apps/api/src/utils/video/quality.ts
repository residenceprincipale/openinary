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

  const isWebm = context.params.format === 'webm';
  const crfValue = isNaN(qualityValue) || qualityValue < 0 || qualityValue > 100
    ? Math.round(51 - (defaultQuality / 100) * 33)
    : Math.round(51 - (qualityValue / 100) * 33);

  if (isWebm) {
    return command
      .videoCodec('libvpx-vp9')
      .addOption('-crf', Math.round(crfValue * 1.2).toString())
      .addOption('-b:v', '0')
      .audioCodec('libopus');
  }

  return command
    .videoCodec('libx264')
    .addOption('-preset', 'ultrafast')
    .addOption('-crf', crfValue.toString())
    .addOption('-tune', 'fastdecode')
    .addOption('-profile:v', 'baseline')
    .addOption('-level', '3.0')
    .audioCodec(volume !== undefined ? 'aac' : 'copy');
};
