import { Hono, type Context } from "hono";
import { promises as fs } from "fs";
import { dirname, extname, join } from "path";
import {
  cleanStorageKey,
  contentTypeForExt,
  deleteCachedFiles,
  logger,
  serializeError,
} from "@openinary/core/light";
import { getDb } from "shared";
import { apiKeyAuth, type AuthVariables } from "../middleware/auth";
import { getSharedStorage } from "../config/storage";
import { enginePaths } from "../config/paths";
import {
  grantPermission,
  hasPermission,
  listPermissions,
  revokePermission,
} from "../utils/permissions";

/**
 * Storage routes that belong to the self-hosted app only (they read the
 * users table): folder sharing and file replacement. Mounted before the
 * core storage route, which owns everything else under /storage.
 */
export function createStorageExtras() {
  const route = new Hono<AuthVariables>();
  route.use("/*", apiKeyAuth);

  const parentOf = (filePath: string) =>
    filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";

  const guard = (c: Context<AuthVariables>, folderPath: string) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }
    if (user.role !== "admin" && !hasPermission(folderPath, user.id)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }
    return null;
  };

  route.get("/permissions", (c) => {
    const folderPath = c.req.query("path") || "";
    const denied = guard(c, folderPath);
    if (denied) return denied;

    try {
      return c.json({ success: true, data: listPermissions(folderPath) });
    } catch (error) {
      logger.error(
        { error: serializeError(error), folderPath },
        "Failed to list permissions",
      );
      return c.json({ error: "Failed to list permissions" }, 500);
    }
  });

  /** Body: { folderPath, userId? , email?, permission? } */
  route.post("/permissions", async (c) => {
    try {
      const body = (await c.req.json()) as {
        folderPath?: string;
        userId?: string;
        email?: string;
        permission?: string;
      };
      const folderPath = body.folderPath;
      if (folderPath === undefined) {
        return c.json({ error: "folderPath is required" }, 400);
      }

      const denied = guard(c, folderPath);
      if (denied) return denied;

      let userId = body.userId;
      if (!userId && body.email) {
        const found = getDb()
          .prepare("SELECT id FROM user WHERE email = ?")
          .get(body.email) as { id: string } | undefined;
        if (!found) return c.json({ error: "User not found with that email" }, 404);
        userId = found.id;
      }
      if (!userId) return c.json({ error: "userId or email is required" }, 400);

      const permission =
        body.permission === "view" || body.permission === "admin"
          ? body.permission
          : "edit";
      const user = c.get("user")!;
      grantPermission(folderPath, userId, user.id, permission);
      logger.info(
        { folderPath, userId, grantedBy: user.id, permission },
        "Permission granted",
      );
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error: serializeError(error) }, "Failed to grant permission");
      return c.json({ error: "Failed to grant permission" }, 500);
    }
  });

  /** Body: { folderPath, userId? , email? } */
  route.delete("/permissions", async (c) => {
    try {
      const body = (await c.req.json()) as {
        folderPath?: string;
        userId?: string;
        email?: string;
      };
      const folderPath = body.folderPath;
      if (folderPath === undefined) {
        return c.json({ error: "folderPath is required" }, 400);
      }

      const denied = guard(c, folderPath);
      if (denied) return denied;

      let userId = body.userId;
      if (!userId && body.email) {
        const found = getDb()
          .prepare("SELECT id FROM user WHERE email = ?")
          .get(body.email) as { id: string } | undefined;
        if (!found) return c.json({ error: "User not found with that email" }, 404);
        userId = found.id;
      }
      if (!userId) return c.json({ error: "userId or email is required" }, 400);

      revokePermission(folderPath, userId);
      logger.info(
        { folderPath, userId, revokedBy: c.get("user")?.id },
        "Permission revoked",
      );
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error: serializeError(error) }, "Failed to revoke permission");
      return c.json({ error: "Failed to revoke permission" }, 500);
    }
  });

  /**
   * Replace a file in place, keeping its path and extension.
   * PUT /storage/replace/{path}
   */
  route.put("/replace/*", async (c) => {
    const raw = c.req.path.replace(/^\/storage\/replace\/?/, "");
    let decoded = raw;
    try {
      decoded = decodeURIComponent(raw);
    } catch {
      // Malformed escape: keep it as sent, cleanStorageKey still vets it.
    }
    const filePath = cleanStorageKey(decoded);
    if (!filePath) {
      return c.json({ success: false, error: "File path is required" }, 400);
    }

    const denied = guard(c, parentOf(filePath));
    if (denied) return denied;

    try {
      const formData = await c.req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return c.json({ success: false, error: "No file provided" }, 400);
      }

      const newExt = extname(file.name).toLowerCase();
      const originalExt = extname(filePath).toLowerCase();
      if (newExt !== originalExt) {
        return c.json(
          {
            success: false,
            error: `Format mismatch: expected "${originalExt}", got "${newExt}"`,
          },
          400,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const contentType = contentTypeForExt(originalExt.slice(1));
      const storage = getSharedStorage();

      if (storage) {
        await storage.uploadOriginal(filePath, buffer, contentType);
        await storage.deleteAllCachedTransformations(filePath);
        storage.invalidateAllCacheEntries(filePath);
      } else {
        const localPath = join(enginePaths.public, filePath);
        await fs.mkdir(dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, buffer);
        await deleteCachedFiles(enginePaths.cache, filePath);
      }

      logger.info({ filePath }, "File replaced");
      return c.json({ success: true });
    } catch (error) {
      logger.error({ error: serializeError(error) }, "Failed to replace file");
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

  return route;
}
