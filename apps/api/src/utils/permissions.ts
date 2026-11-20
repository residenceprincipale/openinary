import crypto from "crypto";
import { getDb } from "shared";

export interface FolderPermission {
  id: string;
  folder_path: string;
  user_id: string;
  permission: string;
  created_by: string;
  created_at: number;
  email?: string;
  name?: string;
}

/** True when `userId` has a grant on `path` or on one of its parents. */
export function hasPermission(path: string, userId: string): boolean {
  const segments = path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
  const prefixes: string[] = [""];
  for (const segment of segments) {
    const previous = prefixes[prefixes.length - 1];
    prefixes.push(previous ? `${previous}/${segment}` : segment);
  }
  const stmt = getDb().prepare(
    "SELECT 1 FROM folder_permissions WHERE folder_path = ? AND user_id = ? LIMIT 1",
  );
  return prefixes.some((prefix) => stmt.get(prefix, userId));
}

export function getUserAccessiblePaths(userId: string): string[] {
  return (
    getDb()
      .prepare("SELECT DISTINCT folder_path FROM folder_permissions WHERE user_id = ?")
      .all(userId) as { folder_path: string }[]
  ).map((row) => row.folder_path);
}

export function isPathAccessible(
  filePath: string,
  accessiblePaths: string[],
): boolean {
  if (accessiblePaths.length === 0) return false;
  return accessiblePaths.some(
    (path) => filePath === path || filePath.startsWith(`${path}/`),
  );
}

export function grantPermission(
  folderPath: string,
  userId: string,
  grantedBy: string,
  permission: "view" | "edit" | "admin" = "edit",
): void {
  getDb()
    .prepare(
      `INSERT INTO folder_permissions (id, folder_path, user_id, permission, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(folder_path, user_id) DO UPDATE SET permission = excluded.permission`,
    )
    .run(crypto.randomUUID(), folderPath, userId, permission, grantedBy, Date.now());
}

export function revokePermission(folderPath: string, userId: string): void {
  getDb()
    .prepare("DELETE FROM folder_permissions WHERE folder_path = ? AND user_id = ?")
    .run(folderPath, userId);
}

/** Grants on one folder, with the users' names for the share dialog. */
export function listPermissions(folderPath: string): FolderPermission[] {
  return getDb()
    .prepare(
      `SELECT p.*, u.email, u.name
       FROM folder_permissions p
       LEFT JOIN user u ON u.id = p.user_id
       WHERE p.folder_path = ?
       ORDER BY u.email ASC`,
    )
    .all(folderPath) as FolderPermission[];
}
