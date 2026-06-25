"""
Import scraped SOE records into Firestore.

Collection: soe_tenders  (separate from the central e-GP 'tenders' collection)
Strategy:   upsert via set(merge=True) — 0 reads, 1 write per record.
            Idempotent: re-running the same master.jsonl is safe.

Usage:
  python import_to_firestore.py
  python import_to_firestore.py --input output/parsed/master.jsonl
  python import_to_firestore.py --source BMA          # filter by source
  python import_to_firestore.py --dry-run             # print what would be written, no writes
  python import_to_firestore.py --collection tenders  # override collection name

Firestore quota cost:
  0 reads.  1 write per record.
  500-op batches (Firestore batch limit).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from google.cloud import firestore
from google.oauth2 import service_account
from tqdm import tqdm

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("import")

# ── Firestore batch size limit ────────────────────────────────────────────────
BATCH_SIZE = 400   # stay under Firestore's 500-op hard limit

# ── Default collection ────────────────────────────────────────────────────────
DEFAULT_COLLECTION = "soe_tenders"

# ── Fields to drop before writing (internal scraper metadata) ─────────────────
SKIP_FIELDS = {"national_id_format", "cross_source_overlap", "also_in_sources"}


def load_credentials() -> service_account.Credentials:
    """
    Load service account credentials from .env.local (same file used by Next.js).
    Looks for FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL,
    FIREBASE_ADMIN_PRIVATE_KEY in .env.local two directories up from this file.
    """
    env_path = Path(__file__).parent.parent / ".env.local"
    if not env_path.exists():
        raise FileNotFoundError(f".env.local not found at {env_path}")

    env_text = env_path.read_text()

    def get_var(name: str) -> str:
        m = re.search(rf'^{name}="?(.*?)"?\s*$', env_text, re.MULTILINE | re.DOTALL)
        if not m:
            raise ValueError(f"{name} not found in .env.local")
        return m.group(1).replace('\\n', '\n').strip()

    project_id   = get_var("FIREBASE_ADMIN_PROJECT_ID")
    client_email = get_var("FIREBASE_ADMIN_CLIENT_EMAIL")
    private_key  = get_var("FIREBASE_ADMIN_PRIVATE_KEY")

    creds = service_account.Credentials.from_service_account_info(
        {
            "type": "service_account",
            "project_id": project_id,
            "private_key_id": "scraped",
            "private_key": private_key,
            "client_email": client_email,
            "token_uri": "https://oauth2.googleapis.com/token",
        },
        scopes=["https://www.googleapis.com/auth/datastore"],
    )
    log.info(f"Credentials loaded for project {project_id}")
    return creds, project_id


def clean_record(raw: dict) -> dict:
    """Remove internal scraper flags and null-clean the record for Firestore."""
    out = {}
    for k, v in raw.items():
        if k in SKIP_FIELDS:
            continue
        # Firestore doesn't accept Python None — use null sentinel or just skip
        if v is None:
            continue
        # Convert list fields
        if isinstance(v, list):
            v = [x for x in v if x is not None]
        out[k] = v
    # Always stamp import time
    out["imported_at"] = datetime.now(timezone.utc).isoformat()
    return out


def load_records(jsonl_path: Path, source_filter: Optional[str]) -> list[dict]:
    records = []
    with jsonl_path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError as e:
                log.warning(f"Skipping bad JSON line: {e}")
                continue

            if source_filter and rec.get("source", "").upper() != source_filter.upper():
                continue

            tender_id = rec.get("tender_id", "").strip()
            if not tender_id:
                log.warning(f"Skipping record with no tender_id: {rec.get('title','?')[:60]}")
                continue

            records.append(rec)
    return records


def run_import(
    jsonl_path: Path,
    collection: str,
    source_filter: Optional[str],
    dry_run: bool,
) -> None:
    records = load_records(jsonl_path, source_filter)
    if not records:
        log.info("No records to import.")
        return

    log.info(f"Loaded {len(records)} records from {jsonl_path}")

    # Dedup within the loaded batch on tender_id (last write wins within same source)
    deduped: dict[str, dict] = {}
    for rec in records:
        key = f"{rec.get('source','?')}:{rec['tender_id']}"
        deduped[key] = rec
    records = list(deduped.values())
    log.info(f"After dedup: {len(records)} unique records")

    if dry_run:
        print(f"\n[DRY RUN] Would upsert {len(records)} records into '{collection}'")
        print(f"  0 reads, {len(records)} writes (Firestore quota cost)")
        print("\nSample records:")
        for rec in records[:5]:
            print(f"  {rec.get('source')}/{rec.get('tender_id')} — {rec.get('title','')[:60]}")
        return

    # Load Firestore client
    creds, project_id = load_credentials()
    db = firestore.Client(project=project_id, credentials=creds)
    col = db.collection(collection)

    # Batch upsert (set with merge=True)
    written = 0
    errors = 0
    source_counts: dict[str, int] = {}

    batch = db.batch()
    batch_count = 0

    for rec in tqdm(records, desc=f"Upserting → {collection}"):
        try:
            # Prefix with source for cross-source uniqueness; replace '/' to avoid
            # Firestore treating it as a sub-collection path separator.
            source = rec.get("source", "UNKNOWN")
            raw_id = rec["tender_id"]
            safe_id = re.sub(r'[/\\]', '_', raw_id)
            doc_id = f"{source}_{safe_id}"
            clean = clean_record(rec)
            ref = col.document(doc_id)
            batch.set(ref, clean, merge=True)
            batch_count += 1
            written += 1
            src = rec.get("source", "?")
            source_counts[src] = source_counts.get(src, 0) + 1

            if batch_count >= BATCH_SIZE:
                batch.commit()
                batch = db.batch()
                batch_count = 0

        except Exception as e:
            log.error(f"Error on {rec.get('tender_id')}: {e}")
            errors += 1

    # Commit remaining
    if batch_count > 0:
        batch.commit()

    print(f"\n{'='*50}")
    print(f"Import complete → Firestore '{collection}'")
    print(f"  Records upserted: {written}")
    print(f"  Errors:           {errors}")
    print(f"  Firestore reads:  0")
    print(f"  Firestore writes: {written}  (~${written/100000*0.18:.4f} USD)")
    print(f"\nPer source:")
    for src, count in sorted(source_counts.items()):
        print(f"  {src}: {count}")


def main():
    parser = argparse.ArgumentParser(description="Import scraped SOE tenders to Firestore")
    parser.add_argument(
        "--input", default="output/parsed/master.jsonl",
        help="Path to master.jsonl (default: output/parsed/master.jsonl)"
    )
    parser.add_argument(
        "--collection", default=DEFAULT_COLLECTION,
        help=f"Firestore collection name (default: {DEFAULT_COLLECTION})"
    )
    parser.add_argument(
        "--source", default=None,
        help="Only import records from this source (e.g. BMA, MEA)"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be written without touching Firestore"
    )
    args = parser.parse_args()

    jsonl_path = Path(args.input)
    if not jsonl_path.is_absolute():
        jsonl_path = Path(__file__).parent / jsonl_path

    if not jsonl_path.exists():
        log.error(f"Input file not found: {jsonl_path}")
        sys.exit(1)

    run_import(
        jsonl_path=jsonl_path,
        collection=args.collection,
        source_filter=args.source,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    main()
