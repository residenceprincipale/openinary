import path from "path";

export function safePath(baseDir: string, userPath: string): string {
  const resolved = path.resolve(baseDir, userPath);
  const root = path.resolve(baseDir);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Path traversal denied");
  }
  return resolved;
}
