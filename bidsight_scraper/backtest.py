"""
BidSight leave-one-out cross-validation backtest.

Loads awarded contracts from a Parquet/CSV file (or directly from Firestore),
runs leave-one-out validation on the BidSight recommendation model, and
reports MAE, beat-winner rate, and profitable rate — the same metrics
tracked by scripts/run-batch-tests.ts on the TypeScript side.

Usage:
    # From a local export (recommended — fast, no reads)
    python3 backtest.py --input output/exports/cgd_contracts.parquet

    # Direct from Firestore (costs reads)
    python3 backtest.py --firestore --limit 5000

    # Tune constants
    python3 backtest.py --input output/exports/cgd_contracts.parquet \\
        --global-median 6.1 --global-sigma 13.9 --min-n 8 --calib-alpha 2

Output columns in results CSV:
    contract_id, category, ref_price, actual_discount, recommended_discount,
    error_pp, beat_winner, profitable, positioning_pct, fallback_used
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Optional

# Allow importing from the same directory
sys.path.insert(0, str(Path(__file__).parent))

import bidsight_core as bc


# ── Loaders ───────────────────────────────────────────────────────────────────

def load_parquet(path: Path) -> list[dict]:
    try:
        import pandas as pd
    except ImportError:
        sys.exit("Missing pandas. Run: pip install pandas pyarrow")
    df = pd.read_parquet(path)
    return df.to_dict("records")


def load_csv_file(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_file(path: Path) -> list[dict]:
    if path.suffix == ".parquet":
        return load_parquet(path)
    if path.suffix == ".csv":
        return load_csv_file(path)
    sys.exit(f"Unsupported file format: {path.suffix}. Use .parquet or .csv")


def load_from_firestore(limit: int) -> list[dict]:
    sys.path.insert(0, str(Path(__file__).parent))
    from export_contracts import load_env_local, _make_firestore_client, fetch_collection
    load_env_local()
    db = _make_firestore_client()
    print(f"Fetching up to {limit:,} contracts from Firestore…")
    return fetch_collection(db, "cgd_contracts", limit=limit)


# ── Field normaliser ──────────────────────────────────────────────────────────

def _field(c: dict, *names: str, default=None):
    for n in names:
        v = c.get(n)
        if v is not None:
            return v
    return default


def _float(c: dict, *names: str) -> Optional[float]:
    v = _field(c, *names)
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _str(c: dict, *names: str) -> Optional[str]:
    v = _field(c, *names)
    return str(v).strip() if v else None


# ── Leave-one-out runner ──────────────────────────────────────────────────────

def run_backtest(
    contracts:    list[dict],
    global_median: float = bc.GLOBAL_MEDIAN,
    global_sigma:  float = bc.GLOBAL_SIGMA,
    min_n:         int   = bc.MIN_N,
    calib_alpha:   int   = bc.CALIB_ALPHA,
    target_margin: float = 10.0,
    target_pos:    float = 50.0,
    verbose:       bool  = True,
) -> list[dict]:
    """
    For each contract c:
      1. Build benchmark tables from ALL contracts EXCEPT c (leave-one-out).
      2. Get the recommendation for c's category / agency / ref-price.
      3. Compare recommended_discount vs actual_discount_from_reference.

    This is expensive O(n²) for large datasets. Use --limit to cap.
    For n > 2000, consider cross-fold (not yet implemented here) instead.
    """
    # Patch module-level constants temporarily
    orig_min_n  = bc.MIN_N
    orig_alpha  = bc.CALIB_ALPHA
    bc.MIN_N    = min_n
    bc.CALIB_ALPHA = calib_alpha

    results: list[dict] = []
    n = len(contracts)
    bar_every = max(1, n // 20)

    for i, c in enumerate(contracts):
        if verbose and i % bar_every == 0:
            print(f"  {i}/{n} ({100*i//n}%)", flush=True, end="\r")

        actual_disc = _float(c, "discountFromReference", "discount_from_reference")
        ref_price   = _float(c, "referencePrice", "reference_price", "budget")
        cid         = _str(c, "_id", "contractId", "contract_id", "id") or str(i)
        category    = _str(c, "projectType", "project_type", "category") or "unknown"
        agency      = _str(c, "agency", "department")
        province    = _str(c, "province")
        cost_ratio  = 1 - (actual_disc or 0) / 100  # cost ≈ bid price

        if actual_disc is None or ref_price is None or ref_price <= 0:
            continue
        if actual_disc < 0 or actual_disc >= 100:
            continue

        # Build tables without this contract
        train = contracts[:i] + contracts[i + 1:]
        tables = bc.build_benchmark_tables(train)
        bench, fallback = bc.get_benchmark_from_tables(
            tables, agency=agency, category=category, province=province, ref_price=ref_price
        )

        rec = bc.recommend_bid(
            ref_price=ref_price,
            cost_m=ref_price * cost_ratio * 0.9,  # assume 10% margin target
            target_margin_pct=target_margin,
            benchmark=bench,
            target_position_pct=target_pos,
        )

        error_pp   = abs(rec.recommended_discount - actual_disc)
        beat_winner = rec.recommended_discount >= actual_disc  # we bid lower price (aggressive enough)
        profitable  = rec.expected_margin > 0

        results.append({
            "contract_id":           cid,
            "category":              category,
            "agency":                agency or "",
            "ref_price":             ref_price,
            "actual_discount":       round(actual_disc, 2),
            "recommended_discount":  rec.recommended_discount,
            "error_pp":              round(error_pp, 2),
            "beat_winner":           int(beat_winner),
            "profitable":            int(profitable),
            "positioning_pct":       rec.positioning_pct,
            "fallback_used":         int(fallback),
            "comparable_n":          rec.comparable_n,
        })

    if verbose:
        print(f"  {n}/{n} (100%)", flush=True)

    # Restore
    bc.MIN_N       = orig_min_n
    bc.CALIB_ALPHA = orig_alpha

    return results


# ── Summary ───────────────────────────────────────────────────────────────────

def print_summary(results: list[dict]) -> dict:
    if not results:
        print("No results.")
        return {}

    n           = len(results)
    mae         = sum(r["error_pp"] for r in results) / n
    beat_rate   = sum(r["beat_winner"] for r in results) / n * 100
    profit_rate = sum(r["profitable"] for r in results) / n * 100
    fallback_rate = sum(r["fallback_used"] for r in results) / n * 100

    print()
    print("─" * 50)
    print(f"  Contracts evaluated : {n:,}")
    print(f"  MAE (pp)            : {mae:.2f}")
    print(f"  Beat-winner rate    : {beat_rate:.1f}%  (target > 45%)")
    print(f"  Profitable rate     : {profit_rate:.1f}%  (target ≈ 100%)")
    print(f"  Fallback used       : {fallback_rate:.1f}%")
    print("─" * 50)

    targets_ok = (mae < 10) and (beat_rate > 45) and (profit_rate >= 95)
    status = "PASS ✓" if targets_ok else "NEEDS TUNING ✗"
    print(f"  Status              : {status}")
    print("─" * 50)

    return {
        "n": n, "mae": mae, "beat_rate": beat_rate,
        "profit_rate": profit_rate, "fallback_rate": fallback_rate,
    }


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="BidSight leave-one-out cross-validation backtest"
    )

    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("--input", "-i", type=Path,
                     help="Path to Parquet/CSV file from export_contracts.py")
    src.add_argument("--firestore", action="store_true",
                     help="Fetch directly from Firestore (costs reads)")

    parser.add_argument("--limit", "-n", type=int, default=2000,
                        help="Max contracts to evaluate (default: 2000)")
    parser.add_argument("--out", "-o", type=Path, default=Path("output/backtest_results.csv"),
                        help="Where to write per-contract results CSV")
    parser.add_argument("--target-margin", type=float, default=10.0)
    parser.add_argument("--target-pos",    type=float, default=50.0)
    parser.add_argument("--global-median", type=float, default=bc.GLOBAL_MEDIAN)
    parser.add_argument("--global-sigma",  type=float, default=bc.GLOBAL_SIGMA)
    parser.add_argument("--min-n",         type=int,   default=bc.MIN_N)
    parser.add_argument("--calib-alpha",   type=int,   default=bc.CALIB_ALPHA)
    parser.add_argument("--quiet", "-q", action="store_true")
    args = parser.parse_args()

    # Patch global constants if overridden
    bc.GLOBAL_MEDIAN = args.global_median
    bc.GLOBAL_SIGMA  = args.global_sigma

    if args.input:
        print(f"Loading {args.input}…")
        contracts = load_file(args.input)
    else:
        contracts = load_from_firestore(args.limit)

    if args.limit and len(contracts) > args.limit:
        contracts = contracts[: args.limit]
    print(f"Loaded {len(contracts):,} contracts.")

    if len(contracts) < 2:
        sys.exit("Not enough contracts to backtest (need at least 2).")

    print(f"\nRunning leave-one-out cross-validation on {len(contracts):,} contracts…")
    results = run_backtest(
        contracts=contracts,
        global_median=args.global_median,
        global_sigma=args.global_sigma,
        min_n=args.min_n,
        calib_alpha=args.calib_alpha,
        target_margin=args.target_margin,
        target_pos=args.target_pos,
        verbose=not args.quiet,
    )

    summary = print_summary(results)

    if results:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        with open(args.out, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
            w.writeheader()
            w.writerows(results)
        print(f"\nPer-contract results → {args.out}")


if __name__ == "__main__":
    main()
