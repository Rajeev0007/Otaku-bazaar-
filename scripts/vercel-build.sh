#!/usr/bin/env bash
# Production build used by `npm run build` and `npm run vercel-build`.
#
# Design: a missing setting must NOT fail the deployment. If the database or AUTH_SECRET is missing,
# the build skips the database steps, prints what to fix, and still deploys; the live site then shows
# a /setup page listing what's missing. Only real errors (e.g. a migration that fails) stop the build.
set -uo pipefail
export NEXT_TELEMETRY_DISABLED=1

warn() { echo "⚠ $*"; }
die() { echo "✗ $*" >&2; exit 1; }

# Accept every variable name the Vercel/Neon integrations use.
export DATABASE_URL="${DATABASE_URL:-${POSTGRES_PRISMA_URL:-${POSTGRES_URL:-}}}"
MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-${DIRECT_URL:-${DATABASE_URL}}}}"

echo "▸ Generating Prisma client"
npx prisma generate || die "prisma generate failed (see the error above)."

ON_VERCEL=false
{ [ "${VERCEL:-}" = "1" ] || [ "${RUN_MIGRATIONS:-}" = "true" ]; } && ON_VERCEL=true

if $ON_VERCEL; then
  SECRET="${AUTH_SECRET:-}"
  [ "${#SECRET}" -lt 32 ] && warn "AUTH_SECRET is missing or shorter than 32 characters. The site will show a setup page until you add it (Settings → Environment Variables)."

  if [ -z "$DATABASE_URL" ]; then
    warn "No database connected (DATABASE_URL). Skipping migrations. Connect Neon in Vercel → Storage, then redeploy."
  elif [ "${SKIP_MIGRATIONS:-}" = "true" ]; then
    echo "▸ SKIP_MIGRATIONS=true, not touching the database"
  else
    echo "▸ Applying database migrations (${VERCEL_ENV:-local})"
    ok=false
    # Retries cover Neon waking from sleep and another deploy holding the migration lock.
    for attempt in 1 2 3 4; do
      if DATABASE_URL="$MIGRATE_URL" npx prisma migrate deploy; then ok=true; break; fi
      warn "Migration attempt $attempt failed; retrying in $((attempt * 5))s"
      sleep $((attempt * 5))
    done
    $ok || die "Database migrations failed. Check that the Neon database is connected to this environment and that DATABASE_URL_UNPOOLED exists."

    echo "▸ First-run setup check"
    DATABASE_URL="$MIGRATE_URL" npx tsx scripts/ensure-setup.ts || die "First-run setup failed (see the error above)."
  fi
fi

echo "▸ Building Next.js"
npx next build || die "next build failed (see the error above)."
echo "✓ Build finished"
