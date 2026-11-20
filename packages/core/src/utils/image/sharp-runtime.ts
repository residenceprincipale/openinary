import sharp from "sharp";

/**
 * libvips keeps decoded images in a process-wide cache (50 MB by default) and
 * runs one thread per CPU. On a small container that cache grows RSS fast and
 * the extra threads contend. Both are env-tunable: raise them for a large
 * dedicated image worker, keep them low next to ffmpeg.
 */
const cacheMb = Number(process.env.SHARP_CACHE_MB ?? 10);
sharp.cache({
  memory: Number.isFinite(cacheMb) ? Math.max(0, cacheMb) : 10,
  files: 0,
  items: 10,
});

const concurrency = Number(process.env.SHARP_CONCURRENCY ?? 1);
sharp.concurrency(Number.isFinite(concurrency) ? Math.max(1, concurrency) : 1);
