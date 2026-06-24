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
