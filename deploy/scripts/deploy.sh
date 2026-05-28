#!/usr/bin/env bash
# Deploy script for partner.711web.com.
# Run as the app user (ubuntu) from /srv/referral-platform.
# Idempotent: safe to re-run on every commit.

set -euo pipefail

APP_DIR=/srv/referral-platform
cd "$APP_DIR"

echo ">> using system node $(node -v) and pnpm $(pnpm -v)"

echo ">> git pull"
git fetch --all --prune
git reset --hard origin/main

echo ">> install deps"
pnpm install --frozen-lockfile

echo ">> apply committed migrations (no regeneration in prod)"
pnpm exec tsx scripts/db-migrate.ts

echo ">> build"
pnpm build

echo ">> reload pm2"
pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
pm2 save

echo ">> deploy done"
pm2 status
