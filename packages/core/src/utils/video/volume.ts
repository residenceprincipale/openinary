import type { TransformFunction } from "./types";

/**
 * Adjust the audio track's volume (v_0-100). A filter forces an audio
 * re-encode, so the codec is chosen here and overrides quality's copy:
 * WebM only muxes Opus/Vorbis, everything else gets AAC.
 */
export const applyVolume: TransformFunction = (command, outputVideoStream, context) => {
  if (context.isThumbnail) return;

  const { volume } = context.params;
  if (volume === undefined) return;

  const volValue = Math.min(Math.max(Number(volume), 0), 100) / 100;
  if (Number.isNaN(volValue)) return;

  if (volValue === 0) return { command: command.addOption("-an") };

  const isWebm = context.outputPath.toLowerCase().endsWith(".webm");
  return {
    command: command
      .audioCodec(isWebm ? "libopus" : "aac")
      .addOption("-filter:a", `volume=${volValue}`),
  };
};
