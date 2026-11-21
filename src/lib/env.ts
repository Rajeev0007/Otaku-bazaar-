// Configuration helpers. Edge-safe (no Node imports) so middleware can use them.
// The only required setting is a database. Everything else is optional or configured in the admin panel.

/** Accepts the names set by the different Vercel/Neon integrations. */
export function resolveDatabaseUrl(): string | undefined {
  const e = process.env;
  return e.DATABASE_URL || e.POSTGRES_PRISMA_URL || e.POSTGRES_URL || undefined;
}

export type ConfigProblem = { key: string; message: string; fix: string };

export function configProblems(): ConfigProblem[] {
  if (resolveDatabaseUrl()) return [];
  return [
    {
      key: "DATABASE_URL",
      message: "No database is connected.",
      fix: "Vercel → Storage → Create Database → Neon → Connect to this project, then redeploy.",
    },
  ];
}
