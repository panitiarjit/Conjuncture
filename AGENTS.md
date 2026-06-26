<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working style

**Disagree when you should.** If a proposed change would break something, cost money, or is the wrong approach — say so clearly with a specific reason before doing it. "The user asked" is not a reason to write bad code or bust the Firestore budget. Push back with a concrete alternative, then let the user decide.

Do not soften disagreements with filler phrases. "That could potentially cause issues" means nothing. "This will add 40k Firestore reads/day and push us over the free tier — here's the alternative" is useful.

If a request is ambiguous, ask one focused question rather than guessing or doing everything possible interpretation.

# Session-start checklist

Run these at the start of every session on this project:

## 1. Check scraper health across all sources

This project scrapes from **two independent pipelines**. Check both.

### e-GP central portal (TypeScript, `scripts/`)

Scrapes the Thai government's central procurement portal into the `tenders` Firestore collection.

```
npx ts-node --project tsconfig.scripts.json scripts/sync-method-ids.ts
```

If it reports new method codes: review `METHOD_ID_MAP` in `lib/procurement.ts` and add any classifiable codes. Unknown codes mean the e-GP portal added a new procurement method — look it up and classify it before the next scrape run.

If tenders on the site show `open` when they should be `closed`, run the status refresh:

```
npx ts-node --project tsconfig.scripts.json scripts/refresh-statuses.ts
```

This reads only currently-open tenders from Firestore and re-scrapes just their date range. It does not fetch new tenders — only updates status of existing ones. More precise than `--days 90`.

### SOE scrapers (Python, `bidsight_scraper/`)

Scrapes BMA, MEA, PEA, PWA, EGAT, MRTA, and PTT into the `soe_tenders` Firestore collection.

```
cd bidsight_scraper && python3 run_all.py --days 7
```

Run a specific source to debug:

```
python3 run_all.py --source ptt --days 7
python3 run_all.py --source bma mea --days 14
```

After a run, check `bidsight_scraper/output/parsed/scrape_summary.txt` for per-source record counts and errors. A source returning 0 records is not always a failure — check whether the site changed its HTML structure or blocked the scraper. `overlap_report.csv` in the same directory flags cross-source duplicate tender IDs.

**Important:** BMA uses the national YYMM+seq ID format but its tenders are NOT present in the central `tenders` collection (verified: 0/19 overlap). BMA is a separate administrative system. Don't assume same-looking IDs mean the same record exists in Firestore.

### SOE tender status — known limitations

Status is set differently per source and not all sources can detect awards:

| Source | Status detection | Can go open → awarded? |
|--------|-----------------|------------------------|
| BMA | API status code (`masterContractAvailableCode`) | ✓ |
| PWA | Infers from `winner_name` presence | ✓ |
| PEA | Compares against submission deadline | ✓ (to "closed") |
| MEA | Always sets "open" — no award page scraped | ✗ |
| EGAT | Always hardcodes "open" — only scrapes active procurement page | ✗ |
| PTT | Only scrapes award results page — always "awarded", no open tenders | ✗ (half-picture) |
| MRTA | Always hardcodes "open" — same gap as EGAT | ✗ |

**EGAT and MEA tenders will never flip to "awarded" in Firestore** — this is a structural gap in the scrapers, not a data bug. If a user sees stale EGAT/MEA open tenders, the fix requires adding award-page scraping to those scrapers, not re-running the existing ones.

For stale status on sources that do support it (BMA, PWA, PEA), extend the lookback window:

```
python3 run_all.py --source bma pwa pea --days 90
```

The default `--days 30` window won't update tenders older than 30 days even if their status changed.

## 2. Check BidSight batch test results and tune the model

Every session, check the latest results:

```
ls -t scripts/test-results/batch-*.json | head -5
cat "$(ls -t scripts/test-results/batch-*.json | head -1)"
```

**Metrics to watch (in priority order):**

| Metric | Target | Flag if |
|--------|--------|---------|
| Cross-batch MAE | < 8pp | > 10pp |
| Cross-batch beat-winner rate | > 45% | dropping across consecutive batches |
| Profitable rate | ~100% | < 95% — margin floor logic has a bug |
| Forward R² | negative is expected | should trend less negative over sweeps |

**Cross-batch is the only honest signal.** The within-batch backward test trains and tests on the same data — it will always look better than reality. Use it to debug, not to judge the model.

When tuning constants in `lib/bidsight-core.ts` (`MIN_N`, `CALIB_ALPHA`, `GLOBAL_MEDIAN`, `GLOBAL_SIGMA`):
- Change one constant at a time
- Run the batch test immediately after: `npx ts-node --project tsconfig.scripts.json scripts/run-batch-tests.ts`
- Only keep the change if cross-batch MAE improves or stays flat. If only within-batch improves, the change is overfitting.

## ⚠️ Firestore cost hard limit: ≤ 50k reads/day (free tier)

Every read over 50k/day costs money. The current budget:

| Source | TTL | Reads/day |
|--------|-----|-----------|
| `tenders` cache (6h) | 6h | 8,000 |
| `soe_tenders` cache (6h) | 6h | 4,000 |
| `benchmark` cache (24h) | 24h | 10,000 |
| `agency-intel` cache (24h) | 24h | 5,000 |
| `market-intel` cache (24h) | 24h | 5,000 |
| Batch test script (daily cron) | — | 10,000 |
| **Total** | | **42,000** |
| **Free tier** | | **50,000** |
| **Remaining buffer** | | **8,000** |

**Before touching any of the following, recalculate reads/day and verify the total stays under 50k:**

- Cache TTLs in `lib/data-service.ts` — shortening any TTL multiplies reads proportionally
- The 10k production cap in `getContractsForBenchmark()` — doubling it costs another 10k reads/day
- Any new `restGetCollection` or `restGetCollectionPage` call in a route handler — each one that runs per-request without a cache is unbounded
- The batch test script's `BATCH_SIZE` constant — it's 10k/day, the maximum we can afford given the buffer

**Hard rules:**
1. Production cap stays at 10k. For analysis on the full dataset, use `scripts/` manually — not a scheduled job.
2. Test scripts (`scripts/*.ts`) cost ~$0.006 per manual run. That's fine. Do not put them on a schedule without accounting for reads/day in the table above.
3. If you need to add a new cached data path, remove or extend an existing one to compensate.

## Cron schedule

| Job | Trigger | What it does |
|-----|---------|--------------|
| e-GP status refresh | Daily 08:00 UTC (15:00 BKK) via GitHub Actions | Updates open/closed on existing e-GP tenders |
| e-GP new listings | Every 3rd day 08:00 UTC | Fetches new e-GP announcements |
| SOE scrapers | `launchd-scrape-soe.sh` on self-hosted mac | BMA, MEA, PEA, PWA, EGAT, MRTA, PTT → `soe_tenders` |
| BidSight batch test | Daily 08:30 UTC via GitHub Actions | Runs one 10k batch, saves results, commits to repo |
| CGD historical fetch | Manual (`fetch-historical.ts`) | Backfills awarded contracts; one-off when needed |

Closed tenders are never deleted — they accumulate in Firestore as historical records.
