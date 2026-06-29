import { Context, Next } from "hono";
import { auth } from "shared/auth";
import logger, { serializeError } from "../utils/logger";

// Define the variables that will be available in the context
export type AuthVariables = {
  Variables: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    } | null;
    apiKey: {
      id: string;
      name: string | null;
      userId: string;
    } | null;
  };
};

/**
 * Structured audit logger for security events
 */
function auditLog(event: string, data: Record<string, any>) {
  logger.info({ event, ...data }, "[Audit]");
}

/**
 * Middleware to verify API key OR session cookie
 * Supports both API key authentication and web app session authentication
 * Attaches user and apiKey info to context if valid
 */
export async function apiKeyAuth(c: Context<AuthVariables>, next: Next) {
  const authHeader = c.req.header("Authorization");
  const cookieHeader = c.req.header("Cookie");
  const clientIP = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
  const db = auth.options.database;

  // Try API key authentication first
  if (authHeader) {
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.substring(7)
      : authHeader;

    if (token) {
      try {
        const result = await auth.api.verifyApiKey({
          body: { key: token },
        });

        if (result.valid && result.key) {
          c.set("apiKey", {
            id: result.key.id,
            name: result.key.name,
            userId: result.key.referenceId,
          });

          c.set("user", {
            id: result.key.referenceId,
            email: "",
            name: "",
            role: '',
          });

          try {
            const user = db.prepare("SELECT role FROM user WHERE id = ?").get(result.key.referenceId) as { role: string } | undefined;
            if (user) c.set("user", { ...c.get("user")!, role: user.role });
          } catch {}

          auditLog("auth.api_key.success", {
            userId: result.key.referenceId,
            apiKeyId: result.key.id,
            apiKeyName: result.key.name,
            path: c.req.path,
            method: c.req.method,
            ip: clientIP,
          });

          await next();
          return;
        } else {
          auditLog("auth.api_key.failed", {
            reason: "invalid_key",
            tokenPrefix: token.substring(0, 8) + "...",
            path: c.req.path,
            method: c.req.method,
            ip: clientIP,
          });
        }
      } catch (error) {
        auditLog("auth.api_key.error", {
          error: error instanceof Error ? error.message : "unknown",
          path: c.req.path,
          method: c.req.method,
          ip: clientIP,
        });
      }
    }
  }

  // If no valid API key, try session cookie authentication
  try {
    if (cookieHeader) {
      const sessionResult = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });

      if (sessionResult && sessionResult.session && sessionResult.user) {
        const userExists = db.prepare("SELECT id FROM user WHERE id = ?").get(sessionResult.user.id);

        if (!userExists) {
          auditLog("auth.session.rejected", {
            reason: "user_not_found_in_db",
            userId: sessionResult.user.id,
            path: c.req.path,
            method: c.req.method,
            ip: clientIP,
          });
        } else {
          c.set("user", {
            id: sessionResult.user.id,
            email: sessionResult.user.email,
            name: sessionResult.user.name,
            role: (sessionResult.user as any).role || 'user',
          });

          c.set("apiKey", null);

          auditLog("auth.session.success", {
            userId: sessionResult.user.id,
            userEmail: sessionResult.user.email,
            path: c.req.path,
            method: c.req.method,
            ip: clientIP,
          });

          await next();
          return;
        }
      }
    }
  } catch (error) {
    logger.error({ error: serializeError(error) }, "Session verification error");
  }

  // Neither API key nor session is valid
  auditLog("auth.failed", {
    reason: "no_valid_credentials",
    path: c.req.path,
    method: c.req.method,
    ip: clientIP,
    hasAuthHeader: !!authHeader,
    hasCookie: !!cookieHeader,
  });
  
  return c.json(
    {
      error: "Authentication required",
      message: "Please provide a valid API key (Authorization: Bearer <key>) or valid session cookie",
    },
    401
  );
}
