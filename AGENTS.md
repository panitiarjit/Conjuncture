<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Session-start checklist

Run these at the start of every session on this project:

## 1. Sync newly discovered e-GP method codes

The scraper writes unknown `methodId` values to Firestore during live runs. Check for them and auto-patch `lib/procurement.ts` if any are classifiable:

```
npx ts-node scripts/sync-method-ids.ts
```

If it reports new entries added, review the `METHOD_ID_MAP` comment block at the top of `lib/procurement.ts` and confirm each mapping is correct. If it reports codes needing manual classification, look them up on the e-GP portal and add them to `KNOWN_CODES` in `scripts/sync-method-ids.ts` and to `METHOD_ID_MAP` in `lib/procurement.ts`.

## 2. Re-check stale open tenders (if asked, or if site shows stale data)

The daily scraper only fetches announcements from the last 3 days. Tenders scraped weeks ago that have since closed won't be updated automatically. Run the targeted refresh script instead — it reads only the currently open tenders from Firestore, derives the exact date range they span, and re-scrapes just that window (skipping any new tenders it encounters):

```
npx ts-node scripts/refresh-statuses.ts
```

This is more precise than a broad `--days 90` sweep: it only updates tenders already in Firestore and only queries back as far as the oldest open tender. Run this if tenders on the site are showing `open` when the user suspects they should be closed.

## Cron schedule (vercel.json)

Both jobs run at 08:00 UTC (15:00 BKK) — one hour after Firestore quota resets at midnight Pacific (07:00 UTC).

| Endpoint                    | Frequency       | What it does                                  |
|-----------------------------|-----------------|-----------------------------------------------|
| `GET /api/refresh-statuses` | Daily           | Checks open/closed status of existing listings |
| `GET /api/scrape`           | Every 3rd day   | Fetches new listings from e-GP                |

Closed tenders are never deleted — they accumulate in Firestore as historical records.
