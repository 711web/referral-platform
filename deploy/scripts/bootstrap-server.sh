#!/usr/bin/env bash
# Bootstrap script for partner.711web.com on the UK box (18.134.35.3).
# Idempotent: safe to re-run. Run AS THE APP USER (ubuntu) with sudo available.
#
# Prerequisites:
#   - You've already cloned this repo to /srv/referral-platform (chown ubuntu:ubuntu)
#   - DNS A record partner.711web.com -> 18.134.35.3 is INSYNC (it is)
#   - nginx + certbot are already installed on the box (from existing 711web.com setup)
#
# This script will:
#   1. Install Node 20 (via nvm), pnpm, PM2 for the current user
#   2. Install Postgres 16 + Redis 7 via apt (idempotent)
#   3. Create the `referral` Postgres role + database with a freshly generated random password
#   4. Write /srv/referral-platform/.env with that password
#   5. Install the nginx vhost for partner.711web.com
#   6. Obtain a TLS certificate via certbot (webroot)
#   7. Reload nginx
#
# After this script: run `bash deploy/scripts/deploy.sh` to do the first deploy.

set -euo pipefail

APP_DIR=/srv/referral-platform
APP_USER=${USER}
ENV_FILE=$APP_DIR/.env
CERT_EMAIL=711webservices@gmail.com
DOMAIN=partner.711web.com

if [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: $APP_DIR is not a git checkout. Clone the repo there first:"
  echo "  sudo mkdir -p $APP_DIR"
  echo "  sudo chown $APP_USER:$APP_USER $APP_DIR"
  echo "  git clone https://github.com/711web/referral-platform $APP_DIR"
  echo "Then re-run this script."
  exit 1
fi

cd "$APP_DIR"

# 1. Node + pnpm + PM2 (for current user)
if [ ! -d "$HOME/.nvm" ]; then
  echo ">> installing nvm"
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "$NVM_DIR/nvm.sh"
if ! nvm ls 20 >/dev/null 2>&1; then
  echo ">> installing node 20"
  nvm install 20
fi
nvm alias default 20 >/dev/null
nvm use 20 >/dev/null
corepack enable
corepack prepare pnpm@9.12.3 --activate
if ! command -v pm2 >/dev/null; then
  echo ">> installing pm2"
  npm install -g pm2
fi

# 2. System packages (idempotent)
echo ">> ensuring postgres-16 + redis-server are installed"
if ! command -v psql >/dev/null || ! dpkg -l postgresql-16 >/dev/null 2>&1; then
  # Postgres 16 isn't in default Ubuntu repos before 24.04 — add PGDG repo
  if [ ! -f /etc/apt/sources.list.d/pgdg.list ]; then
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
      | sudo tee /etc/apt/sources.list.d/pgdg.list
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
      | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg
  fi
  sudo apt-get update
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16
fi
if ! command -v redis-cli >/dev/null; then
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y redis-server
fi
sudo systemctl enable --now postgresql redis-server

# 3. DB role + database
echo ">> ensuring postgres role + database"
DB_PW=$(sudo -u postgres psql -tA -c "SELECT 'EXISTS' FROM pg_roles WHERE rolname='referral'" || echo "")
if [ "$DB_PW" != "EXISTS" ]; then
  NEW_PW=$(openssl rand -base64 32 | tr -d '=+/')
  sudo -u postgres psql <<SQL
CREATE ROLE referral LOGIN PASSWORD '$NEW_PW';
CREATE DATABASE referral OWNER referral;
SQL
  EFFECTIVE_PW=$NEW_PW
  echo ">> generated new DB password (saved in .env below)"
else
  # Role already exists — keep existing pw if .env already has it, otherwise rotate
  if [ -f "$ENV_FILE" ] && grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    echo ">> role exists and .env already has DATABASE_URL — keeping current password"
    EFFECTIVE_PW=$(grep '^DATABASE_URL=' "$ENV_FILE" | sed -n 's|.*://referral:\([^@]*\)@.*|\1|p')
  else
    NEW_PW=$(openssl rand -base64 32 | tr -d '=+/')
    sudo -u postgres psql -c "ALTER ROLE referral PASSWORD '$NEW_PW';"
    EFFECTIVE_PW=$NEW_PW
    echo ">> rotated DB password"
  fi
fi

# 4. Write .env
echo ">> writing $ENV_FILE"
cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://referral:${EFFECTIVE_PW}@localhost:5432/referral
REDIS_URL=redis://localhost:6379
SHORT_DOMAIN=partner.711web.com
NODE_ENV=production
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
  # Uncomment the 443 server block
  sudo sed -i 's/^#TLS_TEMP#//' "/etc/nginx/sites-available/$DOMAIN.conf"
fi
sudo nginx -t && sudo systemctl reload nginx

# PM2 systemd startup hook (run once)
if ! systemctl list-unit-files | grep -q "^pm2-${APP_USER}\.service"; then
  echo ">> setting up pm2 systemd hook"
  pm2 startup systemd -u "$APP_USER" --hp "$HOME" | tail -1 | sudo bash || true
fi

echo ""
echo "=========================================="
echo "Bootstrap complete."
echo "Next: bash deploy/scripts/deploy.sh"
echo "=========================================="
