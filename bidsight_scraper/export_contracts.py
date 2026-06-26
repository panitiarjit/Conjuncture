"""
Export Firestore contract data to Parquet and/or CSV for offline analysis.

Reads credentials the same way import_to_firestore.py does:
  - FIREBASE_ADMIN_PROJECT_ID
  - FIREBASE_ADMIN_CLIENT_EMAIL
  - FIREBASE_ADMIN_PRIVATE_KEY
from the .env.local file two directories up from this file.

Usage:
    python3 export_contracts.py                          # cgd_contracts → output/contracts.parquet
    python3 export_contracts.py --collection soe_tenders --format csv
    python3 export_contracts.py --collection cgd_contracts --limit 5000 --format both
    python3 export_contracts.py --help
"""
from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

# ── Credential loading (identical to import_to_firestore.py) ─────────────────

def load_env_local() -> None:
    env_path = Path(__file__).resolve().parent.parent.parent / ".env.local"
    if not env_path.exists():
        env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if not env_path.exists():
        return
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, val = line.partition("=")
                val = val.strip().strip('"').strip("'")
                if key.strip() not in os.environ:
                    os.environ[key.strip()] = val

load_env_local()

# ── Firestore client ──────────────────────────────────────────────────────────

def _make_firestore_client():
    try:
        from google.cloud import firestore
        from google.oauth2 import service_account
    except ImportError:
        sys.exit("Missing dependencies. Run: pip install google-cloud-firestore google-auth")

    project_id    = os.getenv("FIREBASE_ADMIN_PROJECT_ID")
    client_email  = os.getenv("FIREBASE_ADMIN_CLIENT_EMAIL")
    private_key   = os.getenv("FIREBASE_ADMIN_PRIVATE_KEY", "").replace("\\n", "\n")

    if not all([project_id, client_email, private_key]):
        sys.exit(
            "Missing Firebase credentials. Set FIREBASE_ADMIN_PROJECT_ID, "
            "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local"
        )

    creds = service_account.Credentials.from_service_account_info({
        "type": "service_account",
        "project_id": project_id,
        "private_key_id": "key",
        "private_key": private_key,
        "client_email": client_email,
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
    }, scopes=["https://www.googleapis.com/auth/datastore"])

    return firestore.Client(project=project_id, credentials=creds)


# ── Fetcher ────────────────────────────────────────────────────────────────────

def fetch_collection(
    db,
    collection: str,
    limit: Optional[int] = None,
    batch_size: int = 500,
    filters: Optional[list[tuple]] = None,
    verbose: bool = True,
) -> list[dict]:
    """
    Paginate through a Firestore collection and return all documents as dicts.
    Each dict includes the document ID under the key "_id".

    Args:
        filters: list of (field, op, value) tuples, e.g. [("status", "==", "awarded")]
    """
    try:
        from google.cloud import firestore
    except ImportError:
        sys.exit("Missing google-cloud-firestore")

    col_ref = db.collection(collection)
    query   = col_ref.order_by(firestore.field_path.FieldPath.document_id())

    if filters:
        for field, op, value in filters:
            query = query.where(field, op, value)

    effective_batch = min(batch_size, limit) if limit else batch_size
    query = query.limit(effective_batch)

    records: list[dict] = []
    last_doc = None
    page     = 0

    while True:
        q = query if last_doc is None else query.start_after(last_doc)
        docs = list(q.stream())

        if not docs:
            break

        for doc in docs:
            row = doc.to_dict() or {}
            row["_id"] = doc.id
            records.append(row)

        last_doc = docs[-1]
        page += 1

        if verbose:
            print(f"  Page {page}: fetched {len(docs)} docs ({len(records)} total)", flush=True)

        if limit and len(records) >= limit:
            records = records[:limit]
            break

        if len(docs) < effective_batch:
            break

        time.sleep(0.05)

    return records


# ── Flatten helpers ───────────────────────────────────────────────────────────

def _flatten(d: dict, prefix: str = "", sep: str = ".") -> dict:
    out: dict = {}
    for k, v in d.items():
        key = f"{prefix}{sep}{k}" if prefix else k
        if isinstance(v, dict):
            out.update(_flatten(v, key, sep))
        elif isinstance(v, list):
            out[key] = json.dumps(v, ensure_ascii=False)
        else:
            out[key] = v
    return out


def flatten_records(records: list[dict]) -> list[dict]:
    return [_flatten(r) for r in records]


# ── Writers ───────────────────────────────────────────────────────────────────

def write_parquet(records: list[dict], path: Path) -> None:
    try:
        import pandas as pd
    except ImportError:
        sys.exit("Missing pandas. Run: pip install pandas pyarrow")

    df = pd.DataFrame(flatten_records(records))
    # Coerce Firestore Timestamps to strings
    for col in df.select_dtypes(include="object").columns:
        df[col] = df[col].apply(
            lambda x: str(x) if hasattr(x, "seconds") else x
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    df.to_parquet(path, index=False)
    print(f"Wrote {len(df):,} rows → {path}")


def write_csv(records: list[dict], path: Path) -> None:
    flat = flatten_records(records)
    if not flat:
        print("No records to write.")
        return
    fieldnames = list({k for r in flat for k in r.keys()})
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(flat)
    print(f"Wrote {len(flat):,} rows → {path}")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Export a Firestore collection to Parquet/CSV for offline analysis."
    )
    parser.add_argument(
        "--collection", "-c",
        default="cgd_contracts",
        help="Firestore collection name (default: cgd_contracts)"
    )
    parser.add_argument(
        "--limit", "-n",
        type=int,
        default=None,
        help="Max documents to fetch (default: all)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Documents per Firestore page (default: 500)"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["parquet", "csv", "both"],
        default="parquet",
        help="Output format (default: parquet)"
    )
    parser.add_argument(
        "--out-dir", "-o",
        default="output/exports",
        help="Output directory (default: output/exports)"
    )
    parser.add_argument(
        "--filter",
        action="append",
        metavar="FIELD:OP:VALUE",
        help="Firestore filter, e.g. --filter status:==:awarded. Can repeat."
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress page-by-page progress"
    )
    args = parser.parse_args()

    filters = []
    if args.filter:
        for f in args.filter:
            parts = f.split(":", 2)
            if len(parts) != 3:
                sys.exit(f"Bad filter format '{f}'. Use FIELD:OP:VALUE")
            field, op, value = parts
            filters.append((field, op, value))

    out_dir = Path(args.out_dir)
    stem    = args.collection

    print(f"Connecting to Firestore…")
    db = _make_firestore_client()

    print(f"Fetching '{args.collection}'" + (f" (up to {args.limit:,})" if args.limit else " (all)") + "…")
    records = fetch_collection(
        db=db,
        collection=args.collection,
        limit=args.limit,
        batch_size=args.batch_size,
        filters=filters or None,
        verbose=not args.quiet,
    )
    print(f"Total fetched: {len(records):,}")

    if not records:
        print("No records found — check collection name and filters.")
        return

    if args.format in ("parquet", "both"):
        write_parquet(records, out_dir / f"{stem}.parquet")

    if args.format in ("csv", "both"):
        write_csv(records, out_dir / f"{stem}.csv")


if __name__ == "__main__":
    main()
