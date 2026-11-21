/*
 * Runs during every Vercel build, after migrations. Safe to run repeatedly.
 * 1. First deploy: creates roles, settings, categories, anime, shipping zones, homepage and policy templates.
 *    Existing data is never overwritten.
 * 2. Until an owner (Super Admin) exists: prints a one-time OWNER SETUP CODE in the build log.
 *    Open the site, enter the code on /setup and create the owner account.
 */
import { execSync } from "node:child_process";
import { db } from "../src/server/db";
import { issueSetupCode } from "../src/server/setup";

async function main() {
  if ((await db.role.count()) === 0) {
    console.log("• First deploy: seeding base store data");
    execSync("npx tsx prisma/seed.ts", { stdio: "inherit", env: { ...process.env, SEED_DEMO_ACCOUNTS: "false", SEED_DEMO_PRODUCTS: process.env.SEED_DEMO_PRODUCTS === "true" ? "true" : "false" } });
  } else {
    console.log("• Store data already set up — skipping seed");
  }
  if (!(await issueSetupCode("build"))) console.log("• Owner account exists");
}

main()
  .catch((e) => {
    console.error("✗ setup failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
