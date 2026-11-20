import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import type { TransformDefaults } from "@openinary/core/light";

/**
 * Where the config page persists its settings. Sits beside the auth database
 * so it lands on the same mounted volume in Docker.
 */
export const DATA_DIR =
  process.env.DATA_DIR ??
  (process.env.DB_PATH
    ? dirname(process.env.DB_PATH)
    : join(process.cwd(), "data"));
export const CONFIG_PATH = join(DATA_DIR, "transforms.json");

export interface AppConfig {
  image: {
    quality: number;
    format: string;
    crop: string;
    gravity: string;
    background: string | null;
    radius: string | null;
    aspect: string | null;
    rotate: number | null;
    width: number | null;
    height: number | null;
  };
  video: {
    quality: number;
    format: string;
    autoDownscale: boolean;
    autoDownscaleResolution: number;
    volume: number | null;
    crop: string | null;
    gravity: string | null;
    resize: string | null;
    width: number | null;
    height: number | null;
    startOffset: number | null;
    endOffset: number | null;
  };
  audio: {
    quality: number;
    format: string;
    sampleRate: string;
    channels: string;
  };
  branding: { title: string; logoUrl: string };
}

export const DEFAULT_CONFIG: AppConfig = {
  image: {
    quality: 80,
    format: "auto",
    crop: "fill",
    gravity: "center",
    background: null,
    radius: null,
    aspect: null,
    rotate: null,
    width: null,
    height: null,
  },
  video: {
    quality: 60,
    format: "mp4",
    autoDownscale: true,
    autoDownscaleResolution: 720,
    volume: null,
    crop: null,
    gravity: null,
    resize: null,
    width: null,
    height: null,
    startOffset: null,
    endOffset: null,
  },
  audio: { quality: 192, format: "mp3", sampleRate: "44100", channels: "stereo" },
  branding: { title: "Openinary", logoUrl: "" },
};

export function readConfig(): AppConfig {
  try {
    if (existsSync(CONFIG_PATH)) {
      const saved = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
      return {
        image: { ...DEFAULT_CONFIG.image, ...(saved.image || {}) },
        video: { ...DEFAULT_CONFIG.video, ...(saved.video || {}) },
        audio: { ...DEFAULT_CONFIG.audio, ...(saved.audio || {}) },
        branding: { ...DEFAULT_CONFIG.branding, ...(saved.branding || {}) },
      };
    }
  } catch {
    // Unreadable config falls back to defaults rather than failing startup.
  }
  return DEFAULT_CONFIG;
}

export function writeConfig(config: AppConfig): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

/** The subset the transform engine understands. */
export function getTransformDefaults(): TransformDefaults {
  const config = readConfig();
  return {
    image: {
      quality: config.image.quality,
      crop: config.image.crop as NonNullable<TransformDefaults["image"]>["crop"],
      gravity: config.image.gravity as NonNullable<TransformDefaults["image"]>["gravity"],
    },
    video: {
      quality: config.video.quality,
      autoDownscale: config.video.autoDownscale,
    },
  };
}
