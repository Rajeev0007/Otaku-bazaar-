// First-run owner setup. The first Super Admin is created on /setup using a one-time code that is printed
// in the Vercel build log (and Runtime Logs). This stops a stranger who finds a brand-new site from claiming it.
import { randomInt } from "node:crypto";
import { db } from "@/server/db";
import { hashPassword, sha256, verifyPassword } from "@/server/security/crypto";
import { emailSchema, nameSchema, passwordSchema } from "@/lib/validation";
import { z } from "zod";

const CODE_TTL_HOURS = 72;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

let ownerKnown = false;

/** True once a Super Admin exists. Cached in memory after the first positive answer. */
export async function hasOwner(): Promise<boolean> {
  if (ownerKnown) return true;
  const n = await db.userRole.count({ where: { role: { key: "super_admin" } } });
  if (n > 0) ownerKnown = true;
  return n > 0;
}

export type SetupState = { database: "missing" | "unreachable" | "no_tables" | "ok"; roles: boolean; owner: boolean };

export async function getSetupState(): Promise<SetupState> {
  try {
    const roles = await db.role.count();
    return { database: "ok", roles: roles > 0, owner: roles > 0 && (await hasOwner()) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/does not exist/i.test(msg)) return { database: "no_tables", roles: false, owner: false };
    return { database: "unreachable", roles: false, owner: false };
  }
}

function newCode() {
  const pick = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${pick()}-${pick()}`;
}

/** Creates a fresh setup code (replacing any previous one) and prints it. No-op once an owner exists. */
export async function issueSetupCode(where: "build" | "runtime"): Promise<boolean> {
  if (await hasOwner()) return false;
  const code = newCode();
  const value = { hash: sha256(code), expiresAt: new Date(Date.now() + CODE_TTL_HOURS * 3_600_000).toISOString() };
  await db.setting.upsert({ where: { key: "setup_code" }, create: { key: "setup_code", value }, update: { value } });
  const line = "═".repeat(52);
  console.log(`\n${line}\n  OWNER SETUP CODE: ${code}\n  Open your site, then enter this code on the setup page.\n  Valid ${CODE_TTL_HOURS} hours. (${where})\n${line}\n`);
  return true;
}

export const claimInput = z.object({
  code: z.string().trim().toUpperCase().max(20),
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export class SetupError extends Error {}

/** Creates (or promotes) the owner account. Runs in a transaction so two people can't both become owner. */
export async function claimOwner(raw: unknown) {
  const input = claimInput.parse(raw);
  const stored = await db.setting.findUnique({ where: { key: "setup_code" } });
  const v = stored?.value as { hash?: string; expiresAt?: string } | undefined;
  const normalized = input.code.replace(/[^A-Z0-9]/g, "");
  const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
  if (!v?.hash || !v.expiresAt || new Date(v.expiresAt) < new Date() || sha256(formatted) !== v.hash) {
    throw new SetupError("That setup code is wrong or expired. Use the latest code from the Vercel build log, or generate a new one below.");
  }
  return db.$transaction(async (tx) => {
    const role = await tx.role.findUnique({ where: { key: "super_admin" } });
    if (!role) throw new SetupError("Store data isn't set up yet. Redeploy in Vercel, then try again.");
    if ((await tx.userRole.count({ where: { roleId: role.id } })) > 0) throw new SetupError("This store already has an owner. Sign in instead.");

    let user = await tx.user.findUnique({ where: { email: input.email } });
    if (user) {
      if (!user.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
        throw new SetupError("An account with this email already exists. Enter its current password to make it the owner.");
      }
      user = await tx.user.update({ where: { id: user.id }, data: { isStaff: true, status: "ACTIVE", emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
    } else {
      user = await tx.user.create({
        data: { email: input.email, name: input.name, passwordHash: await hashPassword(input.password), isStaff: true, emailVerifiedAt: new Date(), wishlists: { create: {} } },
      });
    }
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await tx.setting.delete({ where: { key: "setup_code" } });
    await tx.auditLog.create({ data: { actorId: user.id, action: "setup.owner_created", entityType: "User", entityId: user.id, data: { email: input.email } } });
    ownerKnown = true;
    return user;
  });
}
