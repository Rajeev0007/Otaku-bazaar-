import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Uptime check: confirms the app runs and the database (with migrations applied) is reachable. No secrets exposed. */
export async function GET() {
  const started = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    const roles = await db.role.count();
    return NextResponse.json(
      { status: roles > 0 ? "ok" : "needs_setup", database: "ok", setup: roles > 0 ? "done" : "pending", latencyMs: Date.now() - started },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const missingTables = err instanceof Error && /does not exist/i.test(err.message);
    console.error("[health]", err);
    return NextResponse.json(
      { status: "error", database: missingTables ? "migrations_missing" : "unreachable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
