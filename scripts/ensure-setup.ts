/*
 * Runs during every Vercel build (after migrations). Safe to run repeatedly.
 * 1. First deploy only: if the database has no roles yet, runs the seed (roles, settings, categories,
 *    anime, shipping zones, homepage, policy templates; demo products only if SEED_DEMO_PRODUCTS=true).
 * 2. If BOOTSTRAP_ADMIN_EMAIL is set and the store has no Super Admin yet, makes that (already registered)
 *    account the first Super Admin. Once any Super Admin exists this step does nothing.
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const roles = await db.role.count();
  if (roles === 0) {
    console.log("• First deploy: seeding base store data");
    // Explicit defaults: never demo logins on a hosted store; demo products only when asked for.
    execSync("npx tsx prisma/seed.ts", {
      stdio: "inherit",
      env: { ...process.env, SEED_DEMO_ACCOUNTS: "false", SEED_DEMO_PRODUCTS: process.env.SEED_DEMO_PRODUCTS === "true" ? "true" : "false" },
    });
  } else {
    console.log("• Store data already set up — skipping seed");
  }

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return;
  const supers = await db.userRole.count({ where: { role: { key: "super_admin" } } });
  if (supers > 0) {
    console.log("• A Super Admin already exists — BOOTSTRAP_ADMIN_EMAIL ignored (you can remove it)");
    return;
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.log(`• BOOTSTRAP_ADMIN_EMAIL: no account for ${email} yet. Register on the site, then redeploy.`);
    return;
  }
  const role = await db.role.findUniqueOrThrow({ where: { key: "super_admin" } });
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { isStaff: true } }),
    db.userRole.create({ data: { userId: user.id, roleId: role.id } }),
    db.auditLog.create({ data: { action: "staff.bootstrap_super_admin", entityType: "User", entityId: user.id, data: { email, via: "BOOTSTRAP_ADMIN_EMAIL" } } }),
  ]);
  console.log(`✓ ${email} is now the first Super Admin. Remove BOOTSTRAP_ADMIN_EMAIL from Vercel.`);
}

main()
  .catch((e) => {
    console.error("✗ setup failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
