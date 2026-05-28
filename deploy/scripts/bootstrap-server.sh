#!/usr/bin/env bash
# Bootstrap script for partner.711web.com on the UK box (18.134.35.3).
# This box is SHARED with ClaimPilot, 711web.com, fitpanda, jnews, policychecker,
# systempulse — so this script is deliberately additive and uses existing services
# where possible. It will NOT install Node, Postgres, or nginx if already present.
#
# Idempotent: safe to re-run.
#
# Run as the app user (ubuntu) from /srv/referral-platform. The user needs sudo.
#
# What this script does:
#   1. Verifies Node + pnpm + PM2 are present (does NOT install nvm — uses system Node)
#   2. Installs Redis ONLY if missing, configures it with maxmemory=128M for safety
#   3. Adds Postgres role `referral` + database `referral` to the existing cluster
#      (does NOT install postgres — assumes it's already running)
#   4. Writes /srv/referral-platform/.env with a freshly generated DB password
#   5. Installs nginx vhost for partner.711web.com
#   6. Obtains a TLS cert via certbot --webroot
#   7. Reloads nginx
#
# After this: run `bash deploy/scripts/deploy.sh` to do the first deploy.

set -euo pipefail

APP_DIR=/srv/referral-platform
APP_USER=${USER}
ENV_FILE=$APP_DIR/.env
CERT_EMAIL=711webservices@gmail.com
DOMAIN=partner.711web.com
APP_PORT=3002

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: $APP_DIR is not a git checkout. Clone the repo there first:"
  echo "  sudo mkdir -p $APP_DIR"
  echo "  sudo chown $APP_USER:$APP_USER $APP_DIR"
  echo "  git clone https://github.com/711web/referral-platform $APP_DIR"
  exit 1
fi

cd "$APP_DIR"

# 1. Verify Node + pnpm + PM2 (DO NOT install if missing — flag instead)
for tool in node pnpm pm2 nginx psql certbot; do
  if ! command -v "$tool" >/dev/null; then
    echo "ERROR: $tool not found. This is a shared box — install $tool manually before re-running this script."
    exit 1
  fi
done
echo ">> node $(node -v), pnpm $(pnpm -v), pm2 $(pm2 -v) detected"

# 2. Install Redis only if missing
if ! command -v redis-cli >/dev/null; then
  echo ">> installing redis-server (not present on box)"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server
  # Cap memory at 128MB so we can't OOM the shared box
  sudo sed -i 's/^# *maxmemory .*/maxmemory 128mb/' /etc/redis/redis.conf
  sudo sed -i 's/^# *maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
  grep -q '^maxmemory ' /etc/redis/redis.conf || echo 'maxmemory 128mb' | sudo tee -a /etc/redis/redis.conf >/dev/null
  grep -q '^maxmemory-policy ' /etc/redis/redis.conf || echo 'maxmemory-policy allkeys-lru' | sudo tee -a /etc/redis/redis.conf >/dev/null
  sudo systemctl enable --now redis-server
  sudo systemctl restart redis-server
else
  echo ">> redis already installed"
fi
redis-cli ping >/dev/null || { echo "ERROR: redis didn't respond"; exit 1; }

# 3. DB role + database (additive — checks if already exists)
echo ">> ensuring postgres role + database (additive)"
ROLE_EXISTS=$(sudo -u postgres psql -tA -c "SELECT 1 FROM pg_roles WHERE rolname='referral'" 2>/dev/null || echo "")
if [ -z "$ROLE_EXISTS" ]; then
  NEW_PW=$(openssl rand -base64 32 | tr -d '=+/')
  sudo -u postgres psql <<SQL
CREATE ROLE referral LOGIN PASSWORD '$NEW_PW';
CREATE DATABASE referral OWNER referral;
SQL
  EFFECTIVE_PW=$NEW_PW
  echo ">> created role + db with new random password"
else
  if [ -f "$ENV_FILE" ] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    echo ">> role exists and .env has DATABASE_URL — keeping current password"
    EFFECTIVE_PW=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -n 's|.*://referral:\([^@]*\)@.*|\1|p')
  else
    NEW_PW=$(openssl rand -base64 32 | tr -d '=+/')
    sudo -u postgres psql -c "ALTER ROLE referral PASSWORD '$NEW_PW';"
    EFFECTIVE_PW=$NEW_PW
    echo ">> rotated DB password (role existed without .env)"
  fi
fi

# 4. Write .env (preserve AUTH_SECRET across re-runs)
echo ">> writing $ENV_FILE"
EXISTING_AUTH_SECRET=$(grep -E '^AUTH_SECRET=' "$ENV_FILE" 2>/dev/null | cut -d= -f2- || true)
if [ -z "$EXISTING_AUTH_SECRET" ]; then
  EXISTING_AUTH_SECRET=$(openssl rand -base64 32)
fi
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://referral:${EFFECTIVE_PW}@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=production
PORT=${APP_PORT}
AUTH_SECRET=${EXISTING_AUTH_SECRET}
BETTER_AUTH_URL=https://partner.711web.com
EOF
chmod 600 "$ENV_FILE"

# 5. nginx vhost
echo ">> installing nginx vhost for $DOMAIN"
sudo cp "$APP_DIR/deploy/nginx/partner.711web.com.conf" "/etc/nginx/sites-available/$DOMAIN.conf"
sudo ln -sf "/etc/nginx/sites-available/$DOMAIN.conf" "/etc/nginx/sites-enabled/$DOMAIN.conf"

# 6. TLS cert via certbot (webroot)
sudo mkdir -p /var/www/certbot
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo ">> obtaining TLS cert for $DOMAIN"
  # Temporarily comment out the 443 server block so nginx can start without the cert
  sudo sed -i '/listen 443 ssl/,/^}$/s/^/#TLS_TEMP#/' "/etc/nginx/sites-available/$DOMAIN.conf"
  sudo nginx -t && sudo systemctl reload nginx
  sudo certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" \
    --non-interactive --agree-tos -m "$CERT_EMAIL"
  sudo sed -i 's/^#TLS_TEMP#//' "/etc/nginx/sites-available/$DOMAIN.conf"
fi
sudo nginx -t && sudo systemctl reload nginx

# PM2 systemd startup hook (run once per user)
if ! systemctl list-unit-files 2>/dev/null | grep -q "^pm2-${APP_USER}\.service"; then
  echo ">> setting up pm2 systemd hook"
  STARTUP_CMD=$(pm2 startup systemd -u "$APP_USER" --hp "$HOME" 2>&1 | tail -1)
  if [[ "$STARTUP_CMD" == sudo* ]]; then
    eval "$STARTUP_CMD" || true
  fi
fi

echo ""
echo "=========================================="
echo "Bootstrap complete."
echo "App will listen on 127.0.0.1:${APP_PORT} (proxied by nginx for $DOMAIN)."
echo "Next: bash deploy/scripts/deploy.sh"
echo "=========================================="
