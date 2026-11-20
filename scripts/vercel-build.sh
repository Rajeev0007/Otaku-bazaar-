#!/usr/bin/env bash
# Vercel build: generate the Prisma client, apply pending database migrations, then build Next.js.
# Migrations use the direct (non-pooled) connection when available, which Neon requires for DDL.
set -euo pipefail

npx prisma generate

MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${DIRECT_URL:-${DATABASE_URL:-}}}"
if [ -z "$MIGRATE_URL" ]; then
  echo "✗ DATABASE_URL is not set. Add it in Vercel → Project → Settings → Environment Variables (see docs/DEPLOY-VERCEL.md)." >&2
  exit 1
fi
if [ "${SKIP_MIGRATIONS:-}" = "true" ]; then
  echo "• SKIP_MIGRATIONS=true — not applying database migrations"
else
  echo "• Applying database migrations"
  DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy
  DATABASE_URL="$MIGRATE_URL" npx tsx scripts/ensure-setup.ts
fi

npx next build
