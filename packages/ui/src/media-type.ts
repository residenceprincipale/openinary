import type { MediaType } from "./types";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".psd"];
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".flac", ".aac", ".m4a"];
const OTHER_EXTENSIONS = [".pdf", ".zip"];

export function getMediaType(name: string): MediaType | null {
  const lower = name.toLowerCase();
  if (IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "image";
  if (VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "video";
  if (AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "audio";
  if (OTHER_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "other";
  return null;
}
