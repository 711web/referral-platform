# AI Referral Platform — Design

**Date:** 2026-05-28
**Status:** Approved spec, awaiting implementation plan
**Codename:** TBD (placeholder)

---

## 1. Product summary

A two-sided platform combining **dub.co-grade link management** with **Refferly-style campaign and payout flow**, monetized via **AI credits plus usage-based pricing**, with **single-player value on both sides** so neither side has to wait for the other before getting value.

- **Creators** sign up alone. They can manage all their referral links and generate AI post copy even before any brand campaign exists on the platform.
- **Brands** sign up alone. They can post a campaign, hand tracking links to creators they already know, and see conversions — without depending on platform-side discovery.
- AI-matched campaign discovery is the bridge that turns the two single-player products into a network — but it is not the entry point.

Horizontal (no vertical lock-in). Self-hosted on UK EC2 (`18.134.35.3`). Single Next.js monolith. App domain: **`partner.711web.com`** (Route53 zone `Z09210052K47LJB8FCY3L`). Short-link domain TBD (separate domain registration).

## 2. Scope

### 2.1 In scope (MVP)

- Creator and brand signup, profiles, dashboards
- Short link service: `<short-domain>/<slug>` → 302 to destination, with `click_id` cookie
- Campaign creation by brand: offer, commission %, landing URL, status
- Per-creator tracking link generation against a campaign
- Click analytics: count, geo, device, referrer
- Conversion attribution via **server-side webhook** and **JS pixel** (both supported)
- Commission ledger: accrued → approved → paid states
- AI features:
  - Campaign brief generator (brand-side)
  - Post copy generator per platform (creator-side)
  - A/B variant headlines (creator-side)
  - Pitch DM drafts (brand-side)
  - Tag-based campaign↔creator matching (heuristic, nightly batch)
- Stripe Checkout for AI credit packs
- Payouts: **manual CSV export** for MVP, creator paid out-of-band
- Transactional email: signup, conversion notification, weekly digest

### 2.2 Explicitly deferred

- Stripe Connect automated payouts
- Vector or ML-based matching (start with tag overlap and simple ranking)
- Automated fraud detection
- Team workspaces and RBAC beyond owner
- Multi-currency
- Mobile app
- Browser extension
- FTC disclosure compliance scanner
- Bring-your-own short domain verification flow

## 3. Competitive positioning

| Product | Category | Strengths | Gaps we exploit |
|---|---|---|---|
| **dub.co** | Link management | Edge redirects, OSS, dev-first, beautiful UI | No campaigns, no creators, no payouts |
| **Refferly** | AI affiliate marketplace | AI matching, content gen, full-stack flow | Opaque link infra, marketplace cold-start, weak single-player value |
| **ReferralCandy / Friendbuy / Tolt** | Customer referral SaaS | Easy install, proven category | Customer-to-customer only, no creators, ~zero AI |
| **PartnerStack / Impact / Rewardful** | B2B affiliate SaaS | Enterprise attribution, payouts | Expensive, no creator discovery, no AI |

**Our wedge:** the link infra is useful day one for either side alone. A creator can manage their existing Amazon / ShareASale / direct affiliate links here; a brand can run a campaign with creators they already know. The network forms because both sides land on the same link infrastructure.

## 4. System architecture

Single Next.js 15 App Router monolith on UK EC2, behind nginx with Let's Encrypt TLS.

```
                 nginx (TLS, gzip, static cache)
                            │
                ┌───────────┴────────────┐
                │   Next.js (PM2, :3000) │
                │   ├─ /go/[slug]        │  redirect middleware
                │   ├─ /pixel.js         │  static, edge-cached
                │   ├─ /api/conversion   │  webhook in
                │   ├─ /api/stripe/*     │  billing
                │   ├─ /api/ai/*         │  OpenRouter proxy
                │   ├─ /app/(creator)/*  │  creator dashboard
                │   ├─ /app/(brand)/*    │  brand dashboard
                │   └─ /api/auth         │  Lucia or NextAuth
                └─────┬──────────────────┘
                      │
              ┌───────┴────────┐
              ▼                ▼
          Postgres          Redis
        (main store)     (link lookup,
                          rate limit,
                          session)
```

**External services:** OpenRouter (AI), Stripe (credits), Resend or AWS SES (email), Route53 (DNS for `<short-domain>` and app domain).

**Short domain:** a 4–6 character `.co`, `.link`, or `.gg` domain to be registered before launch. Used as `SHORT_DOMAIN` env var in code.

## 5. Data model (Postgres)

```sql
users        (id, email, role[creator|brand|both], handle, created_at, …)
workspaces   (id, owner_user_id, name, kind[creator|brand], …)
domains      (id, workspace_id, host, verified_at)   -- BYO short domains v2

links        (id, workspace_id, slug, destination_url, kind[plain|tracking],
              campaign_id NULL, creator_id NULL, created_at)
clicks       (id, link_id, ts, ip_hash, ua, country, device, referrer,
              click_id_cookie)                       -- write path is async batch

campaigns    (id, brand_workspace_id, name, brief, landing_url, commission_pct,
              commission_flat, currency, status[draft|live|paused|ended], tags[])
campaign_creators (campaign_id, creator_workspace_id, status[invited|joined|removed],
                   tracking_link_id, joined_at)

conversions  (id, click_id_cookie, campaign_id, creator_workspace_id,
              brand_workspace_id, amount, currency, external_order_id,
              source[webhook|pixel], ts, status[pending|approved|reversed])
commissions  (id, conversion_id, creator_workspace_id, amount, currency,
              status[accrued|approved|paid|reversed], created_at, paid_at)

credit_packs (id, workspace_id, credits_remaining, stripe_invoice_id, purchased_at)
ai_usage     (id, workspace_id, feature, model, input_tokens, output_tokens,
              credit_cost, ts)

email_events (id, user_id, kind, ts, payload jsonb)
```

**Indices:** `links(slug)` UNIQUE, `clicks(link_id, ts)`, `conversions(click_id_cookie)`, `conversions(external_order_id, brand_workspace_id)` UNIQUE for idempotency, `campaign_creators(campaign_id, creator_workspace_id)`.

## 6. Hot path — redirect and attribution

### 6.1 `GET /go/:slug`

Handled in Next.js middleware to short-circuit framework overhead:

1. Read `:slug` from URL.
2. Lookup Redis key `link:<slug>` (TTL 1h).
3. Cache miss → `SELECT * FROM links WHERE slug = $1`, populate Redis.
4. Generate `click_id` (ULID). Set cookie `_clid=<id>; Path=/; Max-Age=2592000; SameSite=Lax`.
5. Push click event to an in-memory queue. A worker flushes the queue every 2s with a batch `INSERT INTO clicks`.
6. 302 to `destination_url`, appending UTM params (`utm_source=partner.711web.com&utm_campaign=<slug>`).

**Target latency:** <80ms p95 in-region (UK→UK), <250ms US.

### 6.2 Pixel (`GET /pixel.js`)

Static, nginx-cached. Brand embeds on their thank-you page:

```html
<script async src="https://partner.711web.com/pixel.js"
        data-conversion data-amount="49.00" data-currency="USD"
        data-order-id="ord_123"></script>
```

Because the brand's thank-you page is on a different domain, the pixel cannot read our `_clid` cookie directly. It instead POSTs to `https://partner.711web.com/api/conversion` with the order data and lets the server read the cookie via the request's own `Cookie` header (the user's browser will send it as a third-party cookie if SameSite=Lax allows).

For Safari and other ITP browsers that block this, the brand falls back to the webhook path.

### 6.3 Webhook (`POST /api/conversion`)

Brand's server posts:

```
POST /api/conversion
Headers: X-Brand-Key: pk_..., X-Signature: hmac-sha256(body, brand_secret)
Body:    { click_id, amount, currency, order_id }
```

Returns `{ conversion_id, commission_id, status }`.

### 6.4 Conversion recording (shared by pixel + webhook)

1. Validate signature (webhook) or cookie (pixel).
2. Lookup `click_id` → `click` → `link` → `campaign`.
3. Insert `conversions` row (idempotent by `(external_order_id, brand_workspace_id)`).
4. Insert `commissions` row with status=`accrued`.
5. Emit email to creator: "you earned £X on <campaign>".

**Attribution window:** 30 days from click, last-click wins. Configurable per-brand later.

## 7. AI features (MVP)

All AI calls go through `/api/ai/*` which proxies to OpenRouter and bills in credits.

| Feature | Trigger | Default model | Credits |
|---|---|---|---|
| Campaign brief generator | Brand creates campaign, clicks "draft with AI" | `anthropic/claude-haiku-4.5` | 1 |
| Post copy (per platform) | Creator opens a tracking link, clicks "generate captions" | `anthropic/claude-haiku-4.5` | 1 per platform |
| A/B variant headlines | Creator clicks "more variants" | `anthropic/claude-haiku-4.5` | 1 per 3 variants |
| Pitch DM draft | Brand views creator profile, clicks "draft outreach" | `anthropic/claude-haiku-4.5` | 1 |
| Tag-based matching | Nightly batch job | None — SQL heuristic | free |

**Matching is deliberately heuristic in MVP:** Jaccard similarity on tags between creator profile and campaign, weighted by past creator CTR. Vector matching is v2.

**Credits pricing:** 1 credit = $0.05 sticker, sold as $10 / 200 credits or $40 / 1000. Server cost per Haiku call ≈ $0.005, so margin ≈ 10×.

## 8. Monetization

- **Free tier:** 100 links, 10k clicks/month, 0 included credits.
- **Credits:** pay-as-you-go via Stripe Checkout one-time payments.
- **Pro plan** (v1.1, not MVP): $19/mo for unlimited links, 50k clicks, 100 included credits/mo, branded short domain.
- **Take rate** (v2): 10% platform fee when payouts run through Stripe Connect. Until then, manual payouts mean no take.

## 9. Operations

- **Deploy:** GitHub Actions → SSH to UK box → `git pull && pnpm install && pnpm build && pm2 reload`. Single command.
- **Backups:** nightly `pg_dump` to S3.
- **Monitoring:** Plausible for app analytics, external `/health` uptime check, OpenTelemetry to self-hosted Grafana later.
- **Secrets:** `.env` on the box. Never committed.
- **Rate limiting:** Redis sliding-window on `/api/*` and `/go/:slug` per-IP.
- **Backup edge** (v2): if redirect latency from US becomes the bottleneck, front `/go/*` with a Cloudflare Worker that hits the UK origin with stale-while-revalidate semantics.

## 10. Risks and open questions

1. **Empty marketplace.** Mitigated by single-player wedge. Seed ~20 partner campaigns at launch.
2. **Short domain.** Must be registered before launch. Treated as `SHORT_DOMAIN` env var in code so it can be swapped.
3. **Cross-Atlantic latency.** US-side clicks see 100–200ms redirects. Acceptable for v1; revisit with Cloudflare Worker once MVP has traction.
4. **iOS ITP / cookie blocking.** Pixel attribution under-counts by ~10–20% on Safari. Webhook is the source of truth for brands that integrate it.
5. **AI cost.** OpenRouter spend per signup. Credits + Haiku-class models keep margin healthy. Watch for free-tier abuse.
6. **Fraud.** No automated detection in MVP. Conversions enter `status = pending` and require brand approval for first N days, then auto-approve.

## 11. Out-of-scope work that will eventually matter

These are deliberately not in MVP but should be on the roadmap so we don't paint ourselves into a corner.

- Stripe Connect payouts (v2)
- Cloudflare Worker edge for redirects (v2)
- Vector-based matching with embedding store (v2)
- Fraud detection model (v2)
- FTC disclosure scanner using vision model (v2)
- Browser extension for one-click link shortening (v3)
- Mobile app for creators (v3)
- Public API + SDK (v2)

## 12. Success criteria for MVP

- A creator can sign up, paste 5 destination URLs, get 5 short links, and generate 3 captions in <5 minutes.
- A brand can sign up, post a campaign, generate a tracking link, install the pixel on a test page, and see a conversion appear in the dashboard within 60 seconds of a test click+convert flow.
- 100 sign-ups in 30 days after launch (any side, any quality).
- At least one paid credit pack purchase within 14 days of launch.
- Zero data-loss incidents.
