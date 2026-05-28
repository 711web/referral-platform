# Referral Platform

AI-powered referral platform. Hybrid of dub.co (link infra) + Refferly (campaigns/payouts).
See [`docs/superpowers/specs/2026-05-28-ai-referral-platform-design.md`](docs/superpowers/specs/2026-05-28-ai-referral-platform-design.md) for the full design.

This repo currently implements **Slice 1 — Online Foundation**: short-link service with click logging, deployable as a Next.js monolith on a single Linux box.

## Local development

```bash
# One-time setup
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
psql postgres -c "CREATE ROLE referral LOGIN PASSWORD 'dev_only_referral_pw'; CREATE DATABASE referral OWNER referral;"

# Repo setup
pnpm install
cp .env.example .env.local
pnpm db:push
pnpm seed

# Run
pnpm dev
# then visit:
#   http://localhost:3000             -> holding page
#   http://localhost:3000/go/demo     -> 302 to example.com/page
```

## Tests

```bash
pnpm test                  # vitest unit (6 tests, real PG + Redis)
pnpm test:smoke            # playwright smoke against localhost
SMOKE_BASE_URL=https://partner.711web.com pnpm test:smoke   # against prod
```

## Production

Single Next.js monolith on UK EC2 (`18.134.35.3`, `partner.711web.com`).
Stack: Node 20 (nvm) + pnpm + Next.js standalone + PM2 + nginx + Let's Encrypt.

### First-time prod setup (run once on the box)

As `ubuntu@18.134.35.3`:

```bash
# 1. Clone repo to /srv/referral-platform
sudo mkdir -p /srv/referral-platform
sudo chown ubuntu:ubuntu /srv/referral-platform
git clone https://github.com/711web/referral-platform /srv/referral-platform
cd /srv/referral-platform

# 2. Bootstrap (installs node/pnpm/pm2, postgres+redis if missing,
#    creates DB role with random password, writes .env, sets up nginx vhost + TLS)
bash deploy/scripts/bootstrap-server.sh

# 3. First deploy
bash deploy/scripts/deploy.sh

# 4. Seed at least one link so the smoke test works
psql postgres://referral:$(grep DATABASE_URL .env | cut -d: -f3 | cut -d@ -f1)@localhost/referral \
  -c "INSERT INTO links (slug, destination_url) VALUES ('demo', 'https://example.com/page') ON CONFLICT (slug) DO NOTHING;"
```

After this:
- `https://partner.711web.com` should return 200 with the holding page.
- `https://partner.711web.com/go/demo` should 302 to `https://example.com/page?utm_source=partner.711web.com&utm_campaign=demo`.

### Subsequent deploys

Push to `main` → GitHub Actions runs tests, SSHes into the box, runs `deploy.sh`, smoke-tests.

Set these repo secrets first (Settings → Secrets and variables → Actions):
- `DEPLOY_HOST` = `18.134.35.3`
- `DEPLOY_USER` = `ubuntu`
- `DEPLOY_SSH_KEY` = the private half of a fresh ed25519 keypair whose public half is in `~ubuntu/.ssh/authorized_keys` on the box

Manual deploy from your laptop:

```bash
ssh ubuntu@18.134.35.3 'cd /srv/referral-platform && bash deploy/scripts/deploy.sh'
```

## Slice 1 — Done criteria

- [x] `/go/:slug` returns 302 with `Location` to destination URL plus UTM params
- [x] `_clid` cookie set on first hit, reused on subsequent
- [x] Click row appears in `clicks` table within 3s (async batch writer)
- [x] Unknown slug returns 404
- [x] Vitest + Playwright suites green locally
- [ ] `https://partner.711web.com/go/demo` returns 302 with valid TLS  *(awaiting first deploy)*
- [ ] GitHub Actions auto-deploys on push to main  *(awaiting secrets)*

## What's next (subsequent slices)

| Slice | Scope |
|---|---|
| 2 | Auth (Lucia), workspaces, link CRUD UI |
| 3 | Conversion attribution: `/api/conversion` webhook + `/pixel.js` |
| 4 | Campaigns + per-creator tracking links |
| 5 | OpenRouter AI proxy + Stripe credit packs |
| 6 | Tag-based matching + email + manual payout CSV |
