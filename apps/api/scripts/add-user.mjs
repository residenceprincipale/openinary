#!/usr/bin/env node
import { getDb } from "shared";
import { getAuth } from "shared/auth";

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const [email, password, name] = args.filter((a) => !a.startsWith("--"));

if (!email || !password) {
  console.error("Usage: add-user <email> <password> [name] [--admin]");
  process.exit(1);
}

const isAdmin = flags.includes("--admin");

try {
  const { user } = await getAuth().api.signUpEmail({
    body: { email, password, name: name || email.split("@")[0] },
  });
  getDb()
    .prepare("UPDATE user SET emailVerified = 1, role = ? WHERE id = ?")
    .run(isAdmin ? "admin" : "user", user.id);
  console.log(`User created: ${email}${isAdmin ? " (admin)" : ""}`);
} catch (error) {
  console.error("Failed:", error.message || error);
  process.exit(1);
}
