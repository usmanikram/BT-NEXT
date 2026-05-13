/**
 * Promote an existing user to admin.
 *
 * Usage: npm run promote:admin -- --email you@example.com
 */
import "dotenv/config";
import * as dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { users } from "../db/schema";

dotenv.config({ path: ".env.local" });

async function main() {
  const idx = process.argv.indexOf("--email");
  const email = idx >= 0 ? process.argv[idx + 1] : undefined;
  if (!email) {
    console.error("Usage: --email <user@example.com>");
    process.exit(1);
  }

  const result = await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.email, email.toLowerCase()))
    .returning({ id: users.id, email: users.email });

  if (result.length === 0) {
    console.error(`No user with email "${email}"`);
    process.exit(1);
  }
  console.log(`✓ Promoted ${result[0].email} to admin (${result[0].id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
