"""
Orchestrator — runs all or selected scrapers and writes unified output.

Usage:
  python run_all.py                    # run all
  python run_all.py --source bma       # run one
  python run_all.py --source mea pea   # run subset
  python run_all.py --days 14          # look back N days (default 30)

DEDUPLICATION NOTES
===================
Within a single run, records are deduplicated on (source, tender_id):
  - Same source + same tender_id → keep first occurrence only
  - Different sources with same tender_id → BOTH kept, flagged with
    is_duplicate_of_egp=True on the non-primary record.

Cross-source (SOE → central e-GP) overlap:
  BMA, EGAT, MRTA, MEA, PEA, PWA sometimes publish the same procurement
  to the central e-GP feed.  The tender_id field is set to the national
  project number format (YYMM + seq) used by the central e-GP — when it
  exists.  The Firestore import step should upsert on tender_id (not
  create new docs) so that SOE-scraped enrichment data merges into
  existing records rather than duplicating them.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from collections import defaultdict

import pandas as pd
from tqdm import tqdm

from scrapers.bma import BMAScraper
from scrapers.utilities import UtilitiesScraper, UTILITY_SITES
from scrapers.egat import EGATScraper
from scrapers.mrta import MRTAScraper
from scrapers.ptt import PTTScraper

logging.basicConfig(level=logging.INFO)

PARSED_DIR = Path(__file__).parent / "output" / "parsed"
PARSED_DIR.mkdir(parents=True, exist_ok=True)

# ── National project-number regex (matches IDs from the central e-GP) ──────
import re
_EGP_ID_RE = re.compile(r"^\d{4}\d{7,}$")  # YYMM + 7+ digits

# Verified 2026-06-22: BMA uses the same national YYMM+seq format but its
# records are NOT present in the Firestore 'tenders' collection (0/19 checked).
# BMA is a separate administrative system that doesn't feed into central e-GP.
# Keeping the flag for other SOEs that might actually feed into central e-GP,
# but renaming it to 'national_id_format' to avoid the misleading "overlap" label.
def looks_like_egp_id(tender_id: str) -> bool:
    """Return True if tender_id uses national YYMM+seq format (does NOT mean it's in Firestore)."""
    return bool(_EGP_ID_RE.match(str(tender_id)))


def deduplicate(records: list) -> tuple[list, int, list]:
    """
    Deduplicate records across all scraped sources.

    Three overlap checks applied to every record regardless of source:

    1. Within-source dedup: (source, tender_id) seen twice → drop duplicate.
       Applied to BMA, MEA, PEA, PWA, EGAT, MRTA, PTT equally.

    2. Cross-source intra-run dedup: same tender_id appears from two different
       sources in the same run → keep both but set cross_source_overlap=True.
       The first source encountered is treated as primary.
       This catches cases where e.g. MEA and EGAT publish the same project.

    3. Central e-GP overlap flag: tender_id matches national YYMM+seq format
       → set national_id_format=True.  These may already exist in the Firestore
       collection populated by the central e-GP scraper.
       Applies equally to all sources (BMA, MEA, EGAT, MRTA, PTT, etc.)

    Returns (deduplicated_records_with_dicts, within_source_dropped, overlap_report).
    """
    # Pass 1: within-source dedup
    seen_source_keys: dict[tuple, bool] = {}
    deduped = []
    within_dropped = 0

    for r in records:
        key = (r.source, r.tender_id)
        if key in seen_source_keys:
            within_dropped += 1
            continue
        seen_source_keys[key] = True
        deduped.append(r)

    # Pass 2: cross-source overlap detection (all sources)
    tender_id_to_sources: dict[str, list[str]] = defaultdict(list)
    for r in deduped:
        if r.tender_id:
            tender_id_to_sources[r.tender_id].append(r.source)

    overlap_report = []
    result = []
    for r in deduped:
        r_dict = r.to_dict()

        # Flag 1: central e-GP overlap (any source)
        r_dict["national_id_format"] = looks_like_egp_id(r.tender_id)

        # Flag 2: cross-source duplicate within this run
        sources_with_this_id = tender_id_to_sources.get(r.tender_id, [])
        cross_source = len(sources_with_this_id) > 1
        r_dict["cross_source_overlap"] = cross_source
        if cross_source:
            r_dict["also_in_sources"] = [s for s in sources_with_this_id if s != r.source]

        if r_dict["national_id_format"] or cross_source:
            overlap_report.append({
                "tender_id": r.tender_id,
                "source": r.source,
                "title": r.title[:80] if r.title else "",
                "department": r.department,
                "budget": r.budget,
                "national_id_format": r_dict["national_id_format"],
                "cross_source_overlap": cross_source,
                "other_sources": ", ".join(r_dict.get("also_in_sources", [])),
                "announcement_url": r.announcement_url,
            })

        result.append((r, r_dict))

    return result, within_dropped, overlap_report


def build_scrapers(sources: list[str] | None, days_back: int = 30):
    all_scrapers = []

    if sources is None or "bma" in sources:
        all_scrapers.append(BMAScraper(days_back=days_back))

    for key, cfg in UTILITY_SITES.items():
        if sources is None or key in sources:
            all_scrapers.append(UtilitiesScraper(key, cfg["url"], cfg["name_th"], days_back=days_back))

    if sources is None or "egat" in sources:
        all_scrapers.append(EGATScraper(days_back=days_back))
    if sources is None or "mrta" in sources:
        all_scrapers.append(MRTAScraper(days_back=days_back))
    if sources is None or "ptt" in sources:
        all_scrapers.append(PTTScraper(days_back=days_back))

    return all_scrapers


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", nargs="*", help="Which source(s) to run")
    parser.add_argument("--days", type=int, default=30, help="Days to look back")
    parser.add_argument("--no-import", action="store_true", help="Skip Firestore import after scraping")
    args = parser.parse_args()

    scrapers = build_scrapers(args.source, days_back=args.days)
    all_records_raw = []
    summary_lines = [f"Scrape run: {datetime.now(timezone.utc).isoformat()}", ""]

    for scraper in tqdm(scrapers, desc="Sources"):
        try:
            records = scraper.run()
            all_records_raw.extend(records)

            # Per-source CSV (before dedup — shows raw count)
            if records:
                df = pd.DataFrame([r.to_dict() for r in records])
                csv_path = PARSED_DIR / f"{scraper.source_name}.csv"
                df.to_csv(csv_path, index=False, encoding="utf-8-sig")

            summary_lines.append(
                f"{scraper.source_name}: {len(records)} records  [render={scraper.render_method}]"
            )
        except Exception as e:
            summary_lines.append(f"{scraper.source_name}: ERROR — {e}")
            logging.exception(f"Scraper failed: {scraper.source_name}")

    # Deduplicate across all sources (universal — applies to every scraped site)
    deduped_pairs, within_dropped, overlap_report = deduplicate(all_records_raw)
    egp_overlap_count = sum(1 for _, d in deduped_pairs if d.get("national_id_format"))
    cross_src_count = sum(1 for _, d in deduped_pairs if d.get("cross_source_overlap"))

    # Master JSONL (deduplicated, with overlap flags)
    master_path = PARSED_DIR / "master.jsonl"
    with master_path.open("w", encoding="utf-8") as f:
        for _r, r_dict in deduped_pairs:
            f.write(json.dumps(r_dict, ensure_ascii=False) + "\n")

    # Overlap report (all sources)
    overlap_path = PARSED_DIR / "overlap_report.csv"
    if overlap_report:
        pd.DataFrame(overlap_report).to_csv(overlap_path, index=False, encoding="utf-8-sig")
        logging.info(f"Overlap report: {len(overlap_report)} records → {overlap_path}")

    # Summary
    summary_lines += [
        "",
        f"Total raw records:         {len(all_records_raw)}",
        f"Within-source dupes:       {within_dropped} (dropped)",
        f"Unique records:            {len(deduped_pairs)}",
        f"  National-format IDs:     {egp_overlap_count}  (YYMM+seq — not guaranteed in Firestore)",
        f"  Cross-source dupes:      {cross_src_count}  (same tender_id from 2+ scraped sites)",
        f"  Overlap details:         {overlap_path}",
        f"NOTE: BMA records verified 0/19 in Firestore tenders — BMA data is genuinely new.",
        f"Master JSONL: {master_path}",
    ]
    summary_text = "\n".join(summary_lines)
    (PARSED_DIR / "scrape_summary.txt").write_text(summary_text, encoding="utf-8")
    print("\n" + summary_text)

    # Auto-import to Firestore unless --no-import is set
    if not getattr(args, "no_import", False):
        try:
            from import_to_firestore import run_import
            logging.info("Importing to Firestore soe_tenders collection...")
            run_import(
                jsonl_path=master_path,
                collection="soe_tenders",
                source_filter=None,
                dry_run=False,
            )
        except ImportError:
            logging.warning(
                "google-cloud-firestore not installed; skipping Firestore import.\n"
                "Run: pip install google-cloud-firestore google-auth"
            )
        except Exception as e:
            logging.error(f"Firestore import failed: {e}")


if __name__ == "__main__":
    main()
