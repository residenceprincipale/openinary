import { NextResponse } from "next/server";
import logger from "@/lib/logger";
import { auth, db } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const betterAuthUrl =
    process.env.BETTER_AUTH_URL ||
    (() => {
      const { protocol, host } = new URL(request.url);
      return `${protocol}//${host}`;
    })();

  try {
    // Lock setup if users already exist
    const existingCount = db.prepare("SELECT COUNT(*) as count FROM user").get() as { count: number } | undefined;
    if (existingCount && existingCount.count > 0) {
      return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { email, password, name } = body;

    // Validate required fields
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Email, password, and name are required" },
        { status: 400 },
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 },
      );
    }

    // Validate password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password,
    );

    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return NextResponse.json(
        {
          error:
            "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
        },
        { status: 400 },
      );
    }

    // Call Better Auth directly (server-side) to avoid HTTP round-trips through
    // the public reverse proxy (e.g. Coolify/nginx), which would return HTML
    // instead of JSON and cause "Unexpected token '<'" parse errors.
    logger.info("[Setup] Creating account", { email, betterAuthUrl });

    const authResponse = await auth.api.signUpEmail({
      body: { email, password, name },
    });

    // First user gets admin role
    const count = db.prepare("SELECT COUNT(*) as count FROM user").get() as { count: number };
    if (count.count === 1) {
      db.prepare("UPDATE user SET role = 'admin' WHERE id = ?").run(authResponse.user.id);
    }

    logger.info("[Setup] Account created successfully", { email });
    return NextResponse.json(authResponse, { status: 201 });
  } catch (error: any) {
    logger.error("[Setup] Error creating admin account", {
      error: error.message,
      stack: error.stack,
      betterAuthUrl,
      nodeEnv: process.env.NODE_ENV,
    });

    // Provide more helpful error message for auth errors
    let errorMessage =
      error.message || "An error occurred while creating the account";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
