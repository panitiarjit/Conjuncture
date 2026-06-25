# Conjuncture

Thai government procurement intelligence. 153,000+ awarded contracts from the e-GP system, analyzed and served through a BidSight simulator that tells contractors where their bid price sits in the real market distribution.

**Live:** [conjuncture.work](https://conjuncture.work)

---

## What it does

The Thai government publishes every procurement contract through the e-GP portal (กรมบัญชีกลาง). The data is public but not usable — raw XML across thousands of agencies, no aggregation, no benchmarks.

Conjuncture scrapes it daily, normalizes it, and surfaces three things:

1. **BidSight Simulator** — given your reference price, costs, and target margin, shows which percentile of past winners your bid price falls at, broken down by procurement category (40+ categories)
2. **Market intelligence** — agency discount profiles, HHI concentration index, competition density (median bidder count), province-level benchmarks
3. **Community layer** — contractors report bid outcomes; the model learns real win/loss data to eventually predict win probability, not just positioning percentile

---

## Data sources

| Source | Collection | Update frequency |
|--------|-----------|-----------------|
| e-GP central portal (CGD) | `tenders` | Daily (GitHub Actions) |
| e-GP awarded contracts | `cgd_contracts` | Manual / scheduled |
| BMA, MEA, PEA, PWA, EGAT, MRTA, PTT | `soe_tenders` | Daily (launchd on self-hosted Mac) |
| Bid outcomes (community) | `bid_outcomes` | Real-time |
| Community reports | `community_reports` | Real-time |

---

## Stack

- **Frontend/API:** Next.js App Router, deployed on **Cloudflare Workers** via `open-next` + `wrangler`
- **Database:** Firebase Firestore (free tier, ≤50k reads/day hard limit)
- **Auth:** Firebase Authentication (client-side)
- **Scrapers:** TypeScript (`scripts/`) for e-GP, Python (`bidsight_scraper/`) for SOE sources
- **Email:** Resend
- **Firestore access from Workers:** Custom REST client (`lib/firestore-rest.ts`) — `firebase-admin` is blocked on Cloudflare Workers (uses `eval()`)

---

## Key architectural constraint

**`firebase-admin` does not run on Cloudflare Workers.** All server-side Firestore access in API routes must use `lib/firestore-rest.ts`, which implements the Firestore REST API using Web Crypto + fetch. The `firebase-admin` package is only used in `scripts/` (Node.js context).

---

## Running locally

```bash
npm install
cp .env.local.example .env.local  # fill in Firebase + Resend credentials
npm run dev
```

**Required env vars:**
```
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=
RESEND_API_KEY=
ADMIN_EMAIL=          # comma-separated admin emails for /admin/reports
SCRAPE_SECRET=        # for webhook-triggered scrape runs
```

---

## Scripts

All scripts run in Node.js (firebase-admin available). Use `tsconfig.scripts.json`.

```bash
# Check for new e-GP procurement method IDs
npx ts-node --project tsconfig.scripts.json scripts/sync-method-ids.ts

# Refresh statuses of currently-open tenders
npx ts-node --project tsconfig.scripts.json scripts/refresh-statuses.ts

# Run BidSight batch accuracy test (10k contracts)
npx ts-node --project tsconfig.scripts.json scripts/run-batch-tests.ts

# Run Network Effect loops (agency benchmarks, win models, anomaly detection)
npx ts-node --project tsconfig.scripts.json scripts/run-network-effect.ts
npx ts-node --project tsconfig.scripts.json scripts/run-network-effect.ts --loop 1

# SOE scrapers (Python)
cd bidsight_scraper && python3 run_all.py --days 7
python3 run_all.py --source bma pwa --days 30
```

---

## BidSight model

The core model is in `lib/bidsight-core.ts`. It:

1. Fetches the discount distribution (p10/p25/median/p75/p90) for the selected procurement category from Firestore
2. Applies an S-curve calibration (`CALIB_ALPHA`) to convert a raw discount percentile to a positioning score
3. Given reference price, cost %, and target margin, recommends the bid that maximizes positioning while staying above the margin floor
4. Returns a win curve (CDF of past winners by discount) for visualization

**Constants to tune** (see `AGENTS.md` for the batch-test protocol before changing these):
- `GLOBAL_MEDIAN` — fallback median when no category data
- `GLOBAL_SIGMA` — fallback sigma
- `CALIB_ALPHA` — S-curve steepness
- `MIN_N` — minimum contracts before using category-specific benchmark

---

## Firestore budget (≤50k reads/day)

| Source | TTL | Reads/day |
|--------|-----|-----------|
| `tenders` cache | 6h | ~8,000 |
| `soe_tenders` cache | 6h | ~4,000 |
| `benchmark` cache | 24h | ~10,000 |
| `agency-intel` cache | 24h | ~5,000 |
| Batch test (daily cron) | — | ~10,000 |
| **Total** | | **~37,000** |
| **Free tier** | | **50,000** |

Do not shorten cache TTLs or raise the 10k production cap without recalculating this table.

---

## Network Effect Loops

As bid outcome data accumulates from community reports, three automated improvement loops activate:

| Loop | Gate | What it does |
|------|------|-------------|
| Loop 1 | n≥20 outcomes per agency×category | Blends behavioral discount data (30%) with e-GP benchmarks (70%) |
| Loop 2 | n≥30 matched pairs | Fits logistic regression: discount → P(win) |
| Loop 3 | ≥2 suspicious reports per agency | Creates/updates crowd anomaly records |

Run manually: `scripts/run-network-effect.ts`

---

## License

Data from the Thai government's e-GP system is public domain. Application code is proprietary — Conjuncture Co., Ltd.
