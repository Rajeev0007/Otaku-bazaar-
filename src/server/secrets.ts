// Store secrets without environment variables.
//
// AUTH_SECRET signs short-lived cookies (guest cart, Google sign-in state). If the AUTH_SECRET env var is set
// (32+ chars) it is used; otherwise a random secret is generated once and kept in the database. Sessions don't
// depend on it (they are random tokens stored as hashes), so this only adds setup convenience, not risk.
//
// Integration keys typed into the admin (Resend, Google) are encrypted with AES-256-GCM using a key derived
// from that secret. With the env var set, a stolen database alone can't reveal them; without it, the
// encryption only protects against casual exposure (e.g. a leaked backup excerpt). See SECURITY.md.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/server/db";

let cached: Promise<string> | null = null;

export function getAuthSecret(): Promise<string> {
  const env = process.env.AUTH_SECRET;
  if (env && env.length >= 32) return Promise.resolve(env);
  cached ??= loadOrCreate().catch((err) => {
    cached = null;
    throw err;
  });
  return cached;
}

async function loadOrCreate(): Promise<string> {
  const row = await db.setting.findUnique({ where: { key: "auth_secret" } });
  const existing = (row?.value as { value?: string } | null)?.value;
  if (existing && existing.length >= 32) return existing;
  const value = randomBytes(48).toString("base64url");
  try {
    await db.setting.create({ data: { key: "auth_secret", value: { value } } });
    return value;
  } catch {
    // Another instance created it at the same moment; use theirs.
    const again = await db.setting.findUniqueOrThrow({ where: { key: "auth_secret" } });
    return (again.value as { value: string }).value;
  }
}

function keyFrom(secret: string) {
  return createHash("sha256").update(`${secret}:integrations:v1`).digest();
}

export async function encryptSecret(plain: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(await getAuthSecret()), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

/** Returns null if the value can't be decrypted (e.g. AUTH_SECRET changed); the admin must re-enter it. */
export async function decryptSecret(enc: string | null | undefined): Promise<string | null> {
  if (!enc) return null;
  const [v, iv, tag, ct] = enc.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", keyFrom(await getAuthSecret()), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** For tests. */
export function _resetSecretCache() {
  cached = null;
}
