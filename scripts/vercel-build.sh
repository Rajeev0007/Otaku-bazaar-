#!/usr/bin/env bash
# Production build used by both `npm run build` and `npm run vercel-build`.
#  • Always: generate the Prisma client, then build Next.js.
#  • On Vercel (VERCEL=1) or when RUN_MIGRATIONS=true: apply database migrations and first-run setup first,
#    using the direct (non-pooled) connection when available, which Neon requires for schema changes.
set -euo pipefail

echo "▸ Generating Prisma client"
npx prisma generate

export NEXT_TELEMETRY_DISABLED=1

if [ "${VERCEL:-}" = "1" ]; then
  AUTH_SECRET_CHECK="${AUTH_SECRET:-}"
  if [ "${#AUTH_SECRET_CHECK}" -lt 32 ]; then
    echo "✗ AUTH_SECRET is missing or shorter than 32 characters for this environment (${VERCEL_ENV:-unknown})." >&2
    echo "  Add it in Vercel → Settings → Environment Variables, then redeploy. See docs/DEPLOY-VERCEL.md, Step 6." >&2
    exit 1
  fi
fi

if [ "${VERCEL:-}" = "1" ] || [ "${RUN_MIGRATIONS:-}" = "true" ]; then
  MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${DIRECT_URL:-${POSTGRES_URL_NON_POOLING:-${DATABASE_URL:-}}}}"
  if [ -z "$MIGRATE_URL" ]; then
    echo "✗ No database connection found." >&2
    echo "  Connect a Neon database in Vercel → Storage, or set DATABASE_URL in Settings → Environment Variables." >&2
    echo "  See docs/DEPLOY-VERCEL.md, Step 4." >&2
    exit 1
  fi
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "✗ DATABASE_URL is not set for this environment (${VERCEL_ENV:-unknown})." >&2
    exit 1
  fi
  if [ "${SKIP_MIGRATIONS:-}" = "true" ]; then
    echo "▸ SKIP_MIGRATIONS=true — not touching the database"
  else
    echo "▸ Applying database migrations (${VERCEL_ENV:-local})"
    DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
    echo "▸ First-run setup check"
    DATABASE_URL="$MIGRATE_URL" npx tsx scripts/ensure-setup.ts
  fi
fi

echo "▸ Building Next.js"
npx next build
