import { Hono, type Context, type Next } from "hono";
import { getDb } from "shared";
import { getAuth } from "shared/auth";
import { logger, serializeError } from "@openinary/core/light";
import { apiKeyAuth, type AuthVariables } from "../middleware/auth";

const usersRoute = new Hono<AuthVariables>();
usersRoute.use("/*", apiKeyAuth);

async function requireAdmin(c: Context<AuthVariables>, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "admin") {
    return c.json({ error: "Forbidden", message: "Admin access required" }, 403);
  }
  return next();
}

usersRoute.get("/", requireAdmin, (c) => {
  try {
    const users = getDb()
      .prepare(
        "SELECT id, email, name, role, emailVerified, createdAt, updatedAt, image FROM user ORDER BY createdAt ASC",
      )
      .all();
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
    if (role !== undefined && !["admin", "user"].includes(role)) {
      return c.json({ error: "Invalid role" }, 400);
    }

    const result = await getAuth().api.signUpEmail({
      body: { email, password, name },
    });
    if (role === "admin") {
      getDb().prepare("UPDATE user SET role = 'admin' WHERE id = ?").run(result.user.id);
    }
    return c.json(result, 201);
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to create user");
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to create user" },
      500,
    );
  }
});

usersRoute.patch("/:id", requireAdmin, async (c) => {
  try {
    const { id } = c.req.param();
    const { name, email, role } = await c.req.json();
    const existing = getDb()
      .prepare("SELECT id FROM user WHERE id = ?")
      .get(id) as { id: string } | undefined;
    if (!existing) return c.json({ error: "User not found" }, 404);

    const updates: string[] = [];
    const params: (string | number)[] = [];
    if (name !== undefined) {
      updates.push("name = ?");
      params.push(name);
    }
    if (email !== undefined) {
      updates.push("email = ?");
      params.push(email);
    }
    if (role !== undefined) {
      if (!["admin", "user"].includes(role)) {
        return c.json({ error: "Invalid role" }, 400);
      }
      // The last admin must stay reachable.
      if (role === "user") {
        const admins = getDb()
          .prepare("SELECT COUNT(*) AS count FROM user WHERE role = 'admin'")
          .get() as { count: number };
        if (admins.count <= 1) {
          return c.json({ error: "Cannot demote the last admin" }, 400);
        }
      }
      updates.push("role = ?");
      params.push(role);
    }
    if (updates.length === 0) return c.json({ error: "No fields to update" }, 400);

    params.push(id);
    getDb().prepare(`UPDATE user SET ${updates.join(", ")} WHERE id = ?`).run(...params);
    // shortcut: password changes go through Better Auth, not this route.
    return c.json({ success: true });
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to update user");
    return c.json({ error: "Failed to update user" }, 500);
  }
});

/** id/name/email of shareable users; any authenticated user may call it. */
usersRoute.get("/list", (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Authentication required" }, 401);
    const users = getDb()
      .prepare(
        "SELECT id, name, email FROM user WHERE role != 'admin' ORDER BY name ASC",
      )
      .all();
    return c.json(users);
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to list users");
    return c.json({ error: "Failed to list users" }, 500);
  }
});

usersRoute.get("/:id/folders", requireAdmin, (c) => {
  try {
    const folders = getDb()
      .prepare(
        "SELECT folder_path FROM folder_permissions WHERE user_id = ? ORDER BY folder_path ASC",
      )
      .all(c.req.param("id")) as { folder_path: string }[];
    return c.json(folders.map((folder) => folder.folder_path));
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Failed to list user folders");
    return c.json({ error: "Failed to list user folders" }, 500);
  }
});

usersRoute.delete("/:id", requireAdmin, (c) => {
  try {
    const id = c.req.param("id");
    if (c.get("user")?.id === id) {
      return c.json({ error: "Cannot delete your own account" }, 400);
    }

    const db = getDb();
    const existing = db.prepare("SELECT role FROM user WHERE id = ?").get(id) as
      | { role: string }
      | undefined;
    if (!existing) return c.json({ error: "User not found" }, 404);

    if (existing.role === "admin") {
      const admins = db
        .prepare("SELECT COUNT(*) AS count FROM user WHERE role = 'admin'")
        .get() as { count: number };
      if (admins.count <= 1) {
        return c.json({ error: "Cannot delete the last admin" }, 400);
      }
    }

    db.transaction(() => {
      db.prepare("DELETE FROM folder_permissions WHERE user_id = ?").run(id);
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
