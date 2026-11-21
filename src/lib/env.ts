// Configuration helpers. Edge-safe (no Node imports) so middleware can use them.

/**
 * Database URL for the running app. Accepts the names set by the different Vercel/Neon integrations,
 * so the store works whichever one connected the database.
 */
export function resolveDatabaseUrl(): string | undefined {
  const e = process.env;
  return e.DATABASE_URL || e.POSTGRES_PRISMA_URL || e.POSTGRES_URL || undefined;
}

export type ConfigProblem = { key: string; message: string; fix: string };

/** Settings without which the store cannot run. Reports names only, never values. */
export function configProblems(): ConfigProblem[] {
  const problems: ConfigProblem[] = [];
  if (!resolveDatabaseUrl()) {
    problems.push({
      key: "DATABASE_URL",
      message: "No database is connected.",
      fix: "Vercel → Storage → Create Database → Neon → Connect to this project (Production and Preview), then redeploy.",
    });
  }
  if (process.env.NODE_ENV === "production" && (process.env.AUTH_SECRET?.length ?? 0) < 32) {
    problems.push({
      key: "AUTH_SECRET",
      message: "AUTH_SECRET is missing or shorter than 32 characters.",
      fix: "Vercel → Settings → Environment Variables → add AUTH_SECRET (40+ random characters) for Production and Preview, then redeploy.",
    });
  }
  return problems;
}
