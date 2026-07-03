import type { TransformFunction } from './types';

export const applyVolume: TransformFunction = (command, context) => {
  if (context.isThumbnail) return command;

  const { volume } = context.params;
  if (volume === undefined) return command;

  const volValue = Math.min(Math.max(Number(volume), 0), 100) / 100;
  if (isNaN(volValue)) return command;

  if (volValue === 0) return command.addOption('-an');

  return command.addOption('-filter:a', `volume=${volValue}`);
};
