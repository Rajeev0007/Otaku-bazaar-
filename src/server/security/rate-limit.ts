import { db } from "@/server/db";

export type RateLimitResult = { ok: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window rate limiter stored in Postgres so it works across serverless instances.
 * A single atomic upsert increments the counter, or restarts it when the window has expired.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt", "updatedAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSeconds}), now())
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimit"."resetAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now() THEN now() + make_interval(secs => ${windowSeconds}) ELSE "RateLimit"."resetAt" END,
      "updatedAt" = now()
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  return { ok: row.count <= limit, remaining: Math.max(0, limit - row.count), resetAt: row.resetAt };
}

export async function resetRateLimit(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

export class RateLimitError extends Error {
  constructor(message = "Too many attempts. Please wait a few minutes and try again.") {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number) {
  const r = await rateLimit(key, limit, windowSeconds);
  if (!r.ok) throw new RateLimitError();
}
