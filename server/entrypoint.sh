#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] Waiting for Postgres..."
until node -e "require('net').createConnection({host: 'db', port: 5432}).on('connect', () => {console.log('ok'); process.exit(0)}).on('error',()=>process.exit(1))" >/dev/null 2>&1; do
  sleep 1
done

echo "[entrypoint] Prisma generate"
pnpm prisma generate

echo "[entrypoint] Applying database schema"
# Try to apply migrations first, if they exist
pnpm prisma migrate deploy 2>/dev/null || true

# Always sync schema with db push to ensure all tables exist
echo "[entrypoint] Syncing database schema"
pnpm prisma db push --skip-generate --accept-data-loss

echo "[entrypoint] Seeding database (idempotent)"
pnpm tsx prisma/seed.ts || true

echo "[entrypoint] Starting dev server"
pnpm dev

