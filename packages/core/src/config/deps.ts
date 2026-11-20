import type { Context } from "hono";
import type { CloudStorage } from "../utils/storage/index";
import type { VideoJobQueue } from "../utils/video-job-queue";
import type { EnginePaths } from "./paths";
import type { TransformDefaults } from "../types";

/** Folder-level access control supplied by the host app (self-hosted). */
export interface StorageAccess {
  /**
   * Paths the caller may see. `null` means unrestricted (admin), `[]` means
   * nothing. Ancestors of a visible path are still listed so a shared folder
   * stays reachable.
   */
  visiblePaths(c: Context): string[] | null;
  /** True when the caller may create, rename or delete at `path`. */
  canWrite(c: Context, path: string): boolean;
}

/** What every route factory is built from. */
export interface RouteDeps {
  storage: CloudStorage | null;
  queue: VideoJobQueue;
  paths: EnginePaths;
  /** Signs /authenticated URLs; that route answers 500 without it. */
  apiSecret?: string;
  /**
   * Honour the x-openinary-source-url header on /t. Only for instances whose
   * transform route is not public and whose every caller is trusted.
   */
  allowRemoteSource?: boolean;
  /** Host-app encode defaults; a getter keeps runtime config live. */
  defaults?: TransformDefaults | (() => TransformDefaults);
  /** Folder sharing. Absent means every authenticated caller sees all. */
  access?: StorageAccess;
}
