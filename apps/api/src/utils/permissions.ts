import { db } from "shared";
import crypto from "crypto";

function ensureTable(): void {
  db.exec(`CREATE TABLE IF NOT EXISTS folder_permissions (
    id TEXT PRIMARY KEY,
    folder_path TEXT NOT NULL,
    user_id TEXT NOT NULL,
    permission TEXT NOT NULL DEFAULT 'edit',
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(folder_path, user_id)
  )`);
}

export function hasPermission(path: string, userId: string): boolean {
  ensureTable();
  const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const prefixes: string[] = [""];
  for (const seg of segments) {
    const prev = prefixes[prefixes.length - 1];
    prefixes.push(prev ? `${prev}/${seg}` : seg);
  }
  const stmt = db.prepare("SELECT 1 FROM folder_permissions WHERE folder_path = ? AND user_id = ? LIMIT 1");
  return prefixes.some(p => stmt.get(p, userId));
}

export function getUserAccessiblePaths(userId: string): string[] {
  return (
    db
      .prepare("SELECT DISTINCT folder_path FROM folder_permissions WHERE user_id = ?")
      .all(userId) as { folder_path: string }[]
  ).map((r) => r.folder_path);
}

export function isPathAccessible(
  filePath: string,
  accessiblePaths: string[],
): boolean {
  if (accessiblePaths.length === 0) return false;
  return accessiblePaths.some(
    (p) => filePath === p || filePath.startsWith(p + "/"),
  );
}

export function grantPermission(
  folderPath: string,
  userId: string,
  grantedBy: string,
): void {
  ensureTable();
  db.prepare(
    `INSERT INTO folder_permissions (id, folder_path, user_id, permission, created_by, created_at)
     VALUES (?, ?, ?, 'edit', ?, ?)
     ON CONFLICT(folder_path, user_id) DO NOTHING`,
  ).run(
    crypto.randomUUID(),
    folderPath,
    userId,
    grantedBy,
    Date.now(),
  );
}

export function revokePermission(folderPath: string, userId: string): void {
  db.prepare(
    "DELETE FROM folder_permissions WHERE folder_path = ? AND user_id = ?",
  ).run(folderPath, userId);
}

export function listPermissions(
  folderPath: string,
): { user_id: string; user_email: string | null; user_name: string | null; created_by: string; created_at: number }[] {
  return db
    .prepare(
      `SELECT fp.user_id, u.email as user_email, u.name as user_name, fp.created_by, fp.created_at
       FROM folder_permissions fp
       LEFT JOIN user u ON u.id = fp.user_id
       WHERE fp.folder_path = ?
       ORDER BY fp.created_at`,
    )
    .all(folderPath) as {
      user_id: string;
      user_email: string | null;
      user_name: string | null;
      created_by: string;
      created_at: number;
    }[];
}
