import { Hono } from "hono";
import { createStorageClient } from "../utils/storage";
import fs from "fs";
import path from "path";
import logger, { serializeError } from "../utils/logger";
import { deleteAssetCompletely } from "../utils/asset-deletion";
import { deleteCachedFiles } from "../utils/cache";
import { safePath } from "../utils/path-security";
import type { AuthVariables } from "../middleware/auth";
import { db } from "shared";
import {
  grantPermission,
  revokePermission,
  listPermissions,
  hasPermission,
  getUserAccessiblePaths,
  isPathAccessible,
} from "../utils/permissions";

type StorageNode = {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: StorageNode[];
  size?: number;
  createdAt?: string;
};

type TreeDataItem = {
  id: string;
  name: string;
  children?: TreeDataItem[];
  draggable?: boolean;
  droppable?: boolean;
  disabled?: boolean;
  size?: number;
  createdAt?: string;
};

const storageRoute = new Hono<AuthVariables>();
const storageClient = createStorageClient();

function buildLocalTree(rootDir: string): StorageNode {
  const root: StorageNode = {
    name: "storage",
    path: "",
    type: "directory",
    children: [],
  };

  if (!fs.existsSync(rootDir)) {
    return root;
  }

  const walk = (
    absoluteDir: string,
    relativeDir: string,
    parent: StorageNode,
  ) => {
    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      const relPath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
      const fullPath = path.join(absoluteDir, entry.name);

      if (entry.isDirectory()) {
        const dirNode: StorageNode = {
          name: entry.name,
          path: relPath,
          type: "directory",
          children: [],
        };
        parent.children = parent.children || [];
        parent.children.push(dirNode);
        walk(fullPath, relPath, dirNode);
      } else if (entry.isFile()) {
        const stat = fs.statSync(fullPath);
        const fileNode: StorageNode = {
          name: entry.name,
          path: relPath,
          type: "file",
          size: stat.size,
          createdAt: stat.birthtime.toISOString(),
        };
        parent.children = parent.children || [];
        parent.children.push(fileNode);
      }
    }
  };

  walk(rootDir, "", root);
  return root;
}

function buildTreeFromKeys(keys: { key: string; size?: number; lastModified?: Date }[]): StorageNode {
  const root: StorageNode = {
    name: "storage",
    path: "",
    type: "directory",
    children: [],
  };

  for (const obj of keys) {
    const normalizedKey = obj.key.replace(/^\/+/, "");
    const isFolderMarker = normalizedKey.endsWith("/");
    const parts = normalizedKey.split("/").filter(Boolean);

    if (parts.length === 0) {
      continue;
    }

    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLastPart = i === parts.length - 1;
      const isFile = isLastPart && !isFolderMarker;

      if (isFile) {
        current.children = current.children || [];
        const existing = current.children.find(
          (child) => child.name === part && child.type === "file",
        );
        if (!existing) {
          current.children.push({
            name: part,
            path: currentPath,
            type: "file",
            size: obj.size,
            createdAt: obj.lastModified?.toISOString(),
          });
        } else if (!existing.size && obj.size) {
          existing.size = obj.size;
          existing.createdAt = obj.lastModified?.toISOString();
        }
      } else {
        current.children = current.children || [];
        let dirNode = current.children.find(
          (child) => child.name === part && child.type === "directory",
        );
        if (!dirNode) {
          dirNode = {
            name: part,
            path: currentPath,
            type: "directory",
            children: [],
          };
          current.children.push(dirNode);
        }
        current = dirNode;
      }
    }
  }

  return root;
}

function storageTreeToTreeData(root: StorageNode): TreeDataItem[] {
  if (!root.children) return [];

  const mapNode = (node: StorageNode): TreeDataItem => {
    return {
      id: node.path || node.name,
      name: node.name || node.path,
      children: node.children?.map(mapNode),
      size: node.size,
      createdAt: node.createdAt,
    };
  };

  return root.children.map(mapNode);
}

storageRoute.get("/", async (c) => {
  try {
    const user = c.get("user");
    const isAdmin = user?.role === "admin";

    // Determine accessible paths for non-admin users
    const accessiblePaths = !isAdmin && user?.id
      ? getUserAccessiblePaths(user.id)
      : null;

    const isAccessible = (key: string): boolean => {
      if (isAdmin) return true;
      if (!accessiblePaths) return false;
      return isPathAccessible(key, accessiblePaths);
    };

    let root: StorageNode;

    if (storageClient) {
      const objects = await storageClient.list("public/");
      const publicObjects = objects
        .filter((obj) => obj.key.startsWith("public/"))
        .map((obj) => ({
          ...obj,
          key: obj.key.substring(7),
        }))
        .filter((obj) => isAccessible(obj.key));

      root = buildTreeFromKeys(publicObjects);
    } else {
      const publicDir = path.join(".", "public");

      if (isAdmin) {
        root = buildLocalTree(publicDir);
      } else if (accessiblePaths) {
        // Build tree from accessible subdirectories
        const allFiles: { key: string; size?: number; lastModified?: Date }[] = [];
        const walkLocal = (dir: string, prefix: string) => {
          if (!fs.existsSync(dir)) return;
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              // Add folder marker so empty dirs under shared folders appear in tree
              if (isAccessible(relPath + "/")) {
                allFiles.push({ key: relPath + "/" });
              }
              walkLocal(fullPath, relPath);
            } else if (entry.isFile()) {
              const stat = fs.statSync(fullPath);
              allFiles.push({ key: relPath, size: stat.size, lastModified: stat.birthtime });
            }
          }
        };
        walkLocal(publicDir, "");
        root = buildTreeFromKeys(allFiles.filter((f) => isAccessible(f.key)));
      } else {
        root = { name: "storage", path: "", type: "directory", children: [] };
      }
    }

    const treeData = storageTreeToTreeData(root);
    return c.json(treeData);
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to list storage contents");
    return c.json({ error: "Failed to list storage contents" }, 500);
  }
});

/**
 * GET /storage/permissions?path=... -- list permissions for a folder
 */
storageRoute.get("/permissions", async (c) => {
  const folderPath = c.req.query("path") || "";

  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    if (user.role !== "admin" && !hasPermission(folderPath, user.id)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    const perms = listPermissions(folderPath);
    return c.json({ success: true, data: perms });
  } catch (error) {
    logger.error({ error: serializeError(error), folderPath }, "Failed to list permissions");
    return c.json({ error: "Failed to list permissions" }, 500);
  }
});

/**
 * POST /storage/permissions -- grant a user permission on a folder
 */
storageRoute.post("/permissions", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const body = await c.req.json() as { folderPath?: string; userId?: string; email?: string };
    const { folderPath } = body;
    let userId = body.userId;

    if (!folderPath) {
      return c.json({ error: "folderPath is required" }, 400);
    }

    if (!userId && body.email) {
      const found = db.prepare("SELECT id FROM user WHERE email = ?").get(body.email) as { id: string } | undefined;
      if (!found) return c.json({ error: "User not found with that email" }, 404);
      userId = found.id;
    }

    if (!userId) {
      return c.json({ error: "userId or email is required" }, 400);
    }

    if (user.role !== "admin" && !hasPermission(folderPath, user.id)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    grantPermission(folderPath, userId, user.id);
    logger.info(
      { folderPath, userId, grantedBy: user.id },
      "Permission granted",
    );
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to grant permission");
    return c.json({ error: "Failed to grant permission" }, 500);
  }
});

/**
 * DELETE /storage/permissions -- revoke a user's permission on a folder
 */
storageRoute.delete("/permissions", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const body = await c.req.json() as { folderPath?: string; userId?: string; email?: string };
    const { folderPath } = body;
    let userId = body.userId;

    if (!folderPath) {
      return c.json({ error: "folderPath is required" }, 400);
    }

    if (!userId && body.email) {
      const found = db.prepare("SELECT id FROM user WHERE email = ?").get(body.email) as { id: string } | undefined;
      if (!found) return c.json({ error: "User not found with that email" }, 404);
      userId = found.id;
    }

    if (!userId) {
      return c.json({ error: "userId or email is required" }, 400);
    }

    if (user.role !== "admin" && !hasPermission(folderPath, user.id)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    revokePermission(folderPath, userId);
    logger.info(
      { folderPath, userId, revokedBy: user.id },
      "Permission revoked",
    );
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to revoke permission");
    return c.json({ error: "Failed to revoke permission" }, 500);
  }
});

/**
 * Get file metadata (size, dates)
 * GET /storage/{path}/metadata
 * Note: This route must be placed after GET "/" but before DELETE "/*"
 */
storageRoute.get("/*", async (c) => {
  const requestPath = c.req.path;

  // Only handle requests that end with /metadata
  if (!requestPath.endsWith("/metadata")) {
    return c.notFound();
  }

  // Remove '/storage' prefix and '/metadata' suffix
  // requestPath will be something like '/storage/cows/black.png/metadata'
  // We need to extract 'cows/black.png'
  const pathWithoutPrefix = requestPath
    .replace(/^\/storage\/?/, "")
    .replace(/\/metadata$/, "");

  if (!pathWithoutPrefix) {
    return c.json(
      {
        error: "Bad request",
        message: "File path is required",
      },
      400,
    );
  }

  let filePath = pathWithoutPrefix.replace(/^\/+/, "").replace(/\/+$/, "");

  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    // If decoding fails, use the original path
  }

  // Permission check: user needs view access on the file's folder
  const user = c.get("user");
  if (user && user.role !== "admin") {
    const folderPath = filePath.includes("/")
      ? filePath.substring(0, filePath.lastIndexOf("/"))
      : "";
    if (!hasPermission(folderPath, user.id)) {
      return c.json({ error: "Not found" }, 404);
    }
  }

  try {
    if (storageClient) {
      const metadata = await storageClient.getOriginalMetadata(filePath);
      if (!metadata) {
        return c.json(
          {
            error: "Not found",
            message: "File not found",
          },
          404,
        );
      }

      return c.json({
        size: metadata.size,
        createdAt: metadata.createdAt.toISOString(),
        updatedAt: metadata.updatedAt.toISOString(),
      });
    } else {
      const localPath = safePath("./public", filePath);

      if (!fs.existsSync(localPath)) {
        return c.json(
          {
            error: "Not found",
            message: "File not found",
          },
          404,
        );
      }

      const stats = fs.statSync(localPath);
      if (stats.isDirectory()) {
        return c.json(
          {
            error: "Bad request",
            message: "Cannot get metadata for directories",
          },
          400,
        );
      }

      return c.json({
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
      });
    }
  } catch (error) {
    logger.error(
      { error: serializeError(error), filePath },
      "Failed to get file metadata",
    );
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * Move/rename a file or folder
 * PUT /storage/move
 */
storageRoute.put("/move", async (c) => {
  try {
    const { sourcePath, targetPath } = await c.req.json();

    if (!sourcePath || !targetPath) {
      return c.json({ error: "sourcePath and targetPath are required" }, 400);
    }

    let decodedSource = sourcePath.replace(/^\/+/, "").replace(/\/+$/, "");
    let decodedTarget = targetPath.replace(/^\/+/, "").replace(/\/+$/, "");

    try {
      decodedSource = decodeURIComponent(decodedSource);
    } catch {}
    try {
      decodedTarget = decodeURIComponent(decodedTarget);
    } catch {}

    if (decodedSource === decodedTarget) {
      return c.json({ error: "source and target are the same" }, 400);
    }

    // Permission check: user needs edit on both source and target parent folders
    const moveUser = c.get("user");
    if (moveUser && moveUser.role !== "admin") {
      const srcParent = decodedSource.includes("/")
        ? decodedSource.substring(0, decodedSource.lastIndexOf("/"))
        : "";
      const tgtParent = decodedTarget.includes("/")
        ? decodedTarget.substring(0, decodedTarget.lastIndexOf("/"))
        : "";
      if (
        !hasPermission(srcParent, moveUser.id) ||
        !hasPermission(tgtParent, moveUser.id)
      ) {
        return c.json({ error: "Insufficient permissions" }, 403);
      }
    }

    if (storageClient) {
      await storageClient.move(decodedSource, decodedTarget);
      storageClient.invalidateAllCacheEntries(decodedSource);
    } else {
      const sourceAbsolute = safePath("./public", decodedSource);
      const targetAbsolute = safePath("./public", decodedTarget);

      if (!fs.existsSync(sourceAbsolute)) {
        return c.json({ error: "Source not found" }, 404);
      }

      // Ensure parent directory exists
      const targetDir = path.dirname(targetAbsolute);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.renameSync(sourceAbsolute, targetAbsolute);
    }

    logger.info({ source: decodedSource, target: decodedTarget }, "Moved/renamed asset");
    return c.json({ success: true });
  } catch (error) {
    logger.error(
      { error: serializeError(error) },
      "Failed to move asset",
    );
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * Replace a file — overwrite original + invalidate all caches
 * PUT /storage/replace/*
 */
storageRoute.put("/replace/*", async (c) => {
  const requestPath = c.req.path;
  const pathWithoutPrefix = requestPath.replace(/^\/storage\/replace\/?/, "");

  if (!pathWithoutPrefix) {
    return c.json({ success: false, error: "File path is required" }, 400);
  }

  let filePath = pathWithoutPrefix.replace(/^\/+/, "").replace(/\/+$/, "");
  try { filePath = decodeURIComponent(filePath); } catch {}

  // Permission check: user needs edit on the file's parent folder
  const replaceUser = c.get("user");
  if (replaceUser && replaceUser.role !== "admin") {
    const folderPath = filePath.includes("/")
      ? filePath.substring(0, filePath.lastIndexOf("/"))
      : "";
    if (!hasPermission(folderPath, replaceUser.id)) {
      return c.json({ success: false, error: "Insufficient permissions" }, 403);
    }
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return c.json({ success: false, error: "No file provided" }, 400);
    }

    const newExt = path.extname(file.name).toLowerCase();
    const origExt = path.extname(filePath).toLowerCase();
    if (newExt !== origExt) {
      return c.json({ success: false, error: `Format mismatch: expected "${origExt}", got "${newExt}"` }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (storageClient) {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif",
        ".psd": "image/vnd.adobe.photoshop", ".mp4": "video/mp4", ".mov": "video/quicktime",
        ".webm": "video/webm", ".mp3": "audio/mpeg", ".wav": "audio/wav",
        ".ogg": "audio/ogg", ".flac": "audio/flac", ".aac": "audio/aac",
        ".m4a": "audio/mp4", ".zip": "application/zip", ".pdf": "application/pdf",
      };
      const contentType = mimeMap[ext] ?? "application/octet-stream";

      await storageClient.uploadOriginal(filePath, buffer, contentType);
      await storageClient.deleteAllCachedTransformations(filePath);
      storageClient.invalidateAllCacheEntries(filePath);
    } else {
      const localPath = safePath("./public", filePath);
      const dir = path.dirname(localPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localPath, buffer);
      await deleteCachedFiles(filePath);
    }

    logger.info({ filePath }, "File replaced");
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error: serializeError(error), filePath }, "Failed to replace file");
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

/**
 * Delete a file from storage
 * DELETE /storage/*
 * This now performs a complete deletion including cache and jobs
 */
storageRoute.delete("/*", async (c) => {
  const requestPath = c.req.path;

  // Remove '/storage' prefix from the path
  // requestPath will be something like '/storage/cows/black.png'
  // We need to extract 'cows/black.png'
  const pathWithoutPrefix = requestPath.replace(/^\/storage\/?/, "");

  if (!pathWithoutPrefix) {
    return c.json(
      {
        error: "Bad request",
        message: "File path is required",
      },
      400,
    );
  }

  let filePath = pathWithoutPrefix.replace(/^\/+/, "").replace(/\/+$/, "");

  try {
    filePath = decodeURIComponent(filePath);
  } catch {
    // If decoding fails, use the original path
  }

  // Permission check: user needs edit on the file's parent folder
  const deleteUser = c.get("user");
  if (deleteUser && deleteUser.role !== "admin") {
    const folderPath = filePath.includes("/")
      ? filePath.substring(0, filePath.lastIndexOf("/"))
      : "";
    if (!hasPermission(folderPath, deleteUser.id)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
  }

  try {
    // Use the complete asset deletion function
    const result = await deleteAssetCompletely(filePath, storageClient);

    if (!result.success) {
      // Check if the file was not found
      if (result.errors.some((err) => err.includes("not found"))) {
        return c.json(
          {
            error: "Not found",
            message: "File not found",
          },
          404,
        );
      }

      // Check if trying to delete a directory
      if (
        result.errors.some((err) => err.includes("Cannot delete directories"))
      ) {
        return c.json(
          {
            error: "Bad request",
            message: "Cannot delete directories",
          },
          400,
        );
      }

      // Other errors
      return c.json(
        {
          error: "Partial deletion",
          message: "Asset deleted but some cleanup operations failed",
          details: {
            originalFileDeleted: result.originalFileDeleted,
            jobsDeleted: result.jobsDeleted,
            localCacheFilesDeleted: result.localCacheFilesDeleted,
            cloudCacheFilesDeleted: result.cloudCacheFilesDeleted,
            errors: result.errors,
          },
        },
        result.originalFileDeleted ? 200 : 500,
      );
    }

    return c.json({
      success: true,
      message: "Asset deleted successfully",
      details: {
        jobsDeleted: result.jobsDeleted,
        localCacheFilesDeleted: result.localCacheFilesDeleted,
        cloudCacheFilesDeleted: result.cloudCacheFilesDeleted,
      },
    });
  } catch (error) {
    logger.error(
      { error: serializeError(error), filePath },
      "Failed to delete asset",
    );
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export default storageRoute;
