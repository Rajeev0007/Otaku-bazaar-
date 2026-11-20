/*
 * Grants the Super Admin role to an existing account (the person must register on the site first).
 * Usage: npx tsx scripts/make-admin.ts you@example.com
 * Also runnable without a terminal from GitHub → Actions → "Database setup" → task "make-admin".
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Pass the email address of an existing account.");
  const role = await db.role.findUnique({ where: { key: "super_admin" } });
  if (!role) throw new Error('Roles are missing. Run the "setup" task (npm run db:seed) first.');
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error(`No account for ${email}. Register on the website first, then run this again.`);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { isStaff: true, status: "ACTIVE" } }),
    db.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, create: { userId: user.id, roleId: role.id }, update: {} }),
    db.auditLog.create({ data: { action: "staff.bootstrap_super_admin", entityType: "User", entityId: user.id, data: { email } } }),
  ]);
  console.log(`✓ ${email} is now a Super Admin. Sign out and back in, then open /admin.`);
}

main()
  .catch((e) => {
    console.error(`✗ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
