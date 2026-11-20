/** "bytes=0-1023" -> [0, 1023], clamped to the file. Null when unsatisfiable. */
export function parseRange(
  header: string,
  size: number,
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;

  if (rawStart === "" && rawEnd === "") return null;

  if (rawStart === "") {
    // bytes=-N: the last N bytes
    const suffix = parseInt(rawEnd, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }

  const start = parseInt(rawStart, 10);
  const end = rawEnd === "" ? size - 1 : parseInt(rawEnd, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start >= size || start > end) return null;
  return { start, end: Math.min(end, size - 1) };
}
