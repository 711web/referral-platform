#!/usr/bin/env bash
# Deploy script for partner.711web.com.
# Run as the app user (ubuntu) from /srv/referral-platform.
# Idempotent: safe to re-run on every commit.

set -euo pipefail

APP_DIR=/srv/referral-platform
cd "$APP_DIR"

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
nvm use 20 >/dev/null

echo ">> git pull"
git fetch --all --prune
git reset --hard origin/main

echo ">> install deps"
pnpm install --frozen-lockfile

echo ">> run migrations"
pnpm db:push

echo ">> build"
pnpm build

echo ">> reload pm2"
pm2 startOrReload deploy/pm2/ecosystem.config.cjs --update-env
pm2 save

echo ">> deploy done"
pm2 status
