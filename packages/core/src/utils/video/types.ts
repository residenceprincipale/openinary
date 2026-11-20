import type { FfmpegCommand, FilterSpecification } from "fluent-ffmpeg";
import type { TransformDefaults, VideoTransformParams } from "../../types";

/**
 * Context object containing all information needed for video transformation
 */
export interface VideoContext {
  inputPath: string;
  outputPath: string;
  tmpDir: string;
  params: VideoTransformParams;
  isImageOutput: boolean;
  isThumbnail: boolean;
  /** Probed source duration in seconds. Set for thumbnails so seeks clamp. */
  duration?: number;
  /** Host-app overrides for video encode defaults. */
  defaults?: TransformDefaults;
}

/**
 * Transform function type that takes an ffmpeg command and context,
 * applies a transformation, and returns the modified command
 */
export type TransformFunction = (
  command: FfmpegCommand,
  outputVideoStream: string,
  context: VideoContext,
) =>
  | void
  | TransformFunctionResponse
  | Promise<TransformFunctionResponse | void>;

type TransformFunctionResponse = {
  command?: FfmpegCommand;
  complexFilters?: FilterSpecification[];
  outputVideoStream?: string;
  cleanupFunc?: (() => void) | (() => Promise<void>);
};
