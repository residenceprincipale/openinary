import { Hono } from "hono";
import type { Context } from "hono";
import { auth, db } from "shared/auth";
import type { AuthVariables } from "../middleware/auth";
import logger, { serializeError } from "../utils/logger";

const usersRoute = new Hono<AuthVariables>();

function requireAdmin(c: Context<AuthVariables>, next: () => Promise<void>) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden", message: "Admin access required" }, 403);
  }
  return next();
}

usersRoute.get("/", requireAdmin, async (c) => {
  try {
    const users = db.prepare("SELECT id, email, name, role, emailVerified, createdAt, updatedAt, image FROM user ORDER BY createdAt ASC").all();
    return c.json(users);
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to list users");
    return c.json({ error: "Failed to list users" }, 500);
  }
});

usersRoute.post("/", requireAdmin, async (c) => {
  try {
    const { email, password, name, role } = await c.req.json();
    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }
    const result = await auth.api.signUpEmail({
      body: { email, password, name },
    });
    // Set requested role (defaults to 'user' from table DDL)
    if (role === 'admin') {
      db.prepare("UPDATE user SET role = 'admin' WHERE id = ?").run(result.user.id);
    }
    return c.json(result, 201);
  } catch (error: any) {
    logger.error({ error: serializeError(error) }, "Failed to create user");
    return c.json({ error: error.message || "Failed to create user" }, 500);
  }
});

usersRoute.patch("/:id", requireAdmin, async (c) => {
  try {
    const { id } = c.req.param();
    const { name, email, role } = await c.req.json();
    const existing = db.prepare("SELECT id FROM user WHERE id = ?").get(id) as { id: string } | undefined;
    if (!existing) return c.json({ error: "User not found" }, 404);
    const updates: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { updates.push("name = ?"); params.push(name); }
    if (email !== undefined) { updates.push("email = ?"); params.push(email); }
    if (role !== undefined) {
      if (!["admin", "user"].includes(role)) return c.json({ error: "Invalid role" }, 400);
      updates.push("role = ?"); params.push(role);
    }
    if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);
    params.push(id);
    db.prepare(`UPDATE user SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    // ponytail: password update skipped — needs bcrypt dep or better-auth API
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to update user");
    return c.json({ error: "Failed to update user" }, 500);
  }
});

/**
 * GET /users/list — id/name/email for all users (for share dialog dropdown)
 * Any authenticated user can call this.
 */
usersRoute.get("/list", async (c) => {
  try {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Authentication required" }, 401);
    }
    // ponytail: excludes admins — they already have access to everything
    const users = db.prepare("SELECT id, name, email FROM user WHERE role != 'admin' ORDER BY name ASC").all();
    return c.json(users);
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to list users");
    return c.json({ error: "Failed to list users" }, 500);
  }
});

/**
 * GET /users/:id/folders — list folder paths a user has access to
 * Admin only.
 */
usersRoute.get("/:id/folders", requireAdmin, async (c) => {
  try {
    const { id } = c.req.param();
    const folders = db
      .prepare("SELECT folder_path FROM folder_permissions WHERE user_id = ? ORDER BY folder_path ASC")
      .all(id) as { folder_path: string }[];
    return c.json(folders.map(f => f.folder_path));
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to list user folders");
    return c.json({ error: "Failed to list user folders" }, 500);
  }
});

usersRoute.delete("/:id", requireAdmin, async (c) => {
  try {
    const { id } = c.req.param();
    // Can't delete yourself
    const user = c.get("user");
    if (user?.id === id) {
      return c.json({ error: "Cannot delete your own account" }, 400);
    }
    const existing = db.prepare("SELECT id FROM user WHERE id = ?").get(id);
    if (!existing) {
      return c.json({ error: "User not found" }, 404);
    }
    // Clean up related records
    db.transaction(() => {
      db.prepare("DELETE FROM session WHERE userId = ?").run(id);
      db.prepare("DELETE FROM account WHERE userId = ?").run(id);
      db.prepare("DELETE FROM apiKey WHERE referenceId = ?").run(id);
      db.prepare("DELETE FROM user WHERE id = ?").run(id);
    })();
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to delete user");
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

export default usersRoute;
