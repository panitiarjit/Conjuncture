"""
Fit a logistic-regression win-probability model on community bid outcome data.

Uses the `bid_outcomes` Firestore collection (or a local export of it) to
train a model that predicts P(win | discount, category, competitive_context).

The fitted coefficients let you answer: "if I bid at X% discount, what's my
estimated probability of winning?"

This is the Python equivalent of the Loop 2 ("Win probability") network
effect in lib/network-effect.ts — but runs offline, so you can audit it,
tune features, and export the coefficients without touching the live app.

Usage:
    # From Firestore
    python3 fit_win_model.py --firestore

    # From a local export
    python3 fit_win_model.py --input output/exports/bid_outcomes.parquet

    # Save the fitted model
    python3 fit_win_model.py --input output/exports/bid_outcomes.parquet \\
        --save-model output/win_model.joblib

    # Load saved model and score a bid
    python3 fit_win_model.py --predict --discount 8.5 --category ก่อสร้าง \\
        --load-model output/win_model.joblib
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))


# ── Loader ────────────────────────────────────────────────────────────────────

def load_file(path: Path) -> list[dict]:
    if path.suffix == ".parquet":
        try:
            import pandas as pd
        except ImportError:
            sys.exit("pip install pandas pyarrow")
        return pd.read_parquet(path).to_dict("records")
    if path.suffix == ".csv":
        import csv
        with open(path, encoding="utf-8") as f:
            return list(csv.DictReader(f))
    sys.exit(f"Unsupported format: {path.suffix}")


def load_from_firestore(limit: int) -> list[dict]:
    from export_contracts import load_env_local, _make_firestore_client, fetch_collection
    load_env_local()
    db = _make_firestore_client()
    print(f"Fetching up to {limit:,} bid outcomes from Firestore…")
    return fetch_collection(db, "bid_outcomes", limit=limit)


# ── Feature builder ───────────────────────────────────────────────────────────

def build_features(records: list[dict]):
    """
    Features used:
      - discount_pct         : raw % discount from reference price
      - log_ref_price        : log10(reference price) — captures budget-tier effects
      - is_ebidding          : 1 if method contains ประกวดราคา/e-bidding
      - bidder_count         : number of bidders (if available, else median impute)
      - category_* (one-hot): per-category intercept shift

    Target:
      - won (1/0)
    """
    import numpy as np
    try:
        import pandas as pd
    except ImportError:
        sys.exit("pip install pandas scikit-learn")

    def _float(c: dict, *keys) -> Optional[float]:
        for k in keys:
            v = c.get(k)
            if v is not None:
                try: return float(v)
                except (TypeError, ValueError): pass
        return None

    def _str(c: dict, *keys) -> Optional[str]:
        for k in keys:
            v = c.get(k)
            if v: return str(v).strip()
        return None

    def _method(c: dict) -> str:
        return _str(c, "procurementMethod", "procurement_method", "method") or ""

    rows = []
    for c in records:
        won      = c.get("won") or c.get("result") == "won"
        disc     = _float(c, "discountPct", "discount_pct", "discountFromReference", "discount_from_reference")
        ref_p    = _float(c, "referencePrice", "reference_price", "refPrice", "budget")
        category = _str(c, "projectType", "project_type", "category") or "other"
        n_bid    = _float(c, "bidderCount", "bidder_count", "nBidders")
        method   = _method(c)

        if disc is None or ref_p is None or ref_p <= 0:
            continue

        rows.append({
            "won":         int(bool(won)),
            "discount":    disc,
            "log_ref":     np.log10(ref_p),
            "is_ebidding": int(bool("ประกวดราคา" in method or "e-bidding" in method.lower())),
            "bidders":     n_bid if n_bid is not None else float("nan"),
            "category":    category,
        })

    if not rows:
        return None, None, None, None

    df = pd.DataFrame(rows)

    # Impute missing bidder counts with the column median
    median_bidders = df["bidders"].median()
    df["bidders"] = df["bidders"].fillna(median_bidders)

    # One-hot encode category (drop first to avoid collinearity)
    cat_dummies = pd.get_dummies(df["category"], prefix="cat", drop_first=True, dtype=float)
    df = pd.concat([df.drop(columns=["category"]), cat_dummies], axis=1)

    X = df.drop(columns=["won"]).values
    y = df["won"].values
    feature_names = list(df.drop(columns=["won"]).columns)

    return X, y, feature_names, df


# ── Model ─────────────────────────────────────────────────────────────────────

def fit_model(X, y, feature_names: list[str], cv: int = 5):
    try:
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler
        from sklearn.model_selection import cross_val_score, StratifiedKFold
        from sklearn.metrics import roc_auc_score
        import numpy as np
    except ImportError:
        sys.exit("pip install scikit-learn")

    n_pos = int(y.sum())
    n_neg = len(y) - n_pos
    print(f"\nDataset: {len(y):,} outcomes ({n_pos:,} wins / {n_neg:,} losses)")

    if n_pos < 10 or n_neg < 10:
        sys.exit("Not enough positive or negative examples (need ≥ 10 each). "
                 "Collect more bid outcomes before fitting.")

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("lr",     LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])

    skf    = StratifiedKFold(n_splits=min(cv, n_pos), shuffle=True, random_state=42)
    scores = cross_val_score(pipe, X, y, cv=skf, scoring="roc_auc")
    print(f"\nCross-validated AUC: {scores.mean():.3f} ± {scores.std():.3f}")

    # Fit on all data
    pipe.fit(X, y)
    lr = pipe.named_steps["lr"]

    # Coefficients (unscaled back to original units)
    coef = lr.coef_[0] / pipe.named_steps["scaler"].scale_
    print("\nFeature coefficients (log-odds per unit):")
    for fname, c in sorted(zip(feature_names, coef), key=lambda x: -abs(x[1])):
        print(f"  {fname:<30s} {c:+.4f}")
    print(f"  {'(intercept)':<30s} {lr.intercept_[0]:+.4f}")

    return pipe, {"auc_mean": float(scores.mean()), "auc_std": float(scores.std())}


# ── Scorer ────────────────────────────────────────────────────────────────────

def predict_win_prob(
    pipe,
    feature_names: list[str],
    discount: float,
    log_ref: float   = 7.0,    # log10(10M THB) — mid-range default
    is_ebidding: int = 1,
    bidders: float   = 4.0,
    category: Optional[str] = None,
) -> float:
    import numpy as np

    row = {"discount": discount, "log_ref": log_ref, "is_ebidding": is_ebidding, "bidders": bidders}

    # Populate category dummies — all zero if category not in training set
    for fname in feature_names:
        if fname.startswith("cat_"):
            cat_name = fname[4:]
            row[fname] = 1.0 if (category and category == cat_name) else 0.0

    X = np.array([[row.get(f, 0.0) for f in feature_names]])
    return float(pipe.predict_proba(X)[0][1])


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Fit BidSight win-probability logistic model")

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--input", "-i", type=Path, help="Path to bid_outcomes Parquet/CSV")
    mode.add_argument("--firestore", action="store_true", help="Fetch from Firestore")
    mode.add_argument("--predict", action="store_true", help="Score a single bid (requires --load-model)")

    parser.add_argument("--limit",      "-n",  type=int,   default=10000)
    parser.add_argument("--cv",                type=int,   default=5,    help="CV folds")
    parser.add_argument("--save-model", type=Path, help="Where to save fitted model (joblib)")
    parser.add_argument("--load-model", type=Path, help="Load previously saved model")

    # Prediction args
    parser.add_argument("--discount",    type=float)
    parser.add_argument("--category",   type=str)
    parser.add_argument("--ref-price",  type=float, help="Reference price in THB (used for log_ref)")
    parser.add_argument("--bidders",    type=float, default=4.0)
    parser.add_argument("--no-ebidding", action="store_true")

    args = parser.parse_args()

    # ── Predict mode ──────────────────────────────────────────────────────────
    if args.predict:
        if not args.load_model or not args.discount:
            sys.exit("--predict requires --load-model and --discount")
        try:
            import joblib
            import numpy as np
        except ImportError:
            sys.exit("pip install joblib scikit-learn")
        data = joblib.load(args.load_model)
        pipe = data["model"]
        fname = data["feature_names"]
        log_ref = np.log10(args.ref_price) if args.ref_price else 7.0
        p = predict_win_prob(
            pipe, fname,
            discount=args.discount,
            log_ref=log_ref,
            is_ebidding=0 if args.no_ebidding else 1,
            bidders=args.bidders,
            category=args.category,
        )
        print(f"\nP(win | discount={args.discount:.1f}%"
              + (f", category={args.category}" if args.category else "")
              + f") = {p:.1%}")
        return

    # ── Fit mode ──────────────────────────────────────────────────────────────
    if args.input:
        records = load_file(args.input)
    elif args.firestore:
        records = load_from_firestore(args.limit)
    else:
        parser.error("Specify --input, --firestore, or --predict")

    if len(records) > args.limit:
        records = records[: args.limit]

    print(f"Loaded {len(records):,} bid outcomes.")
    X, y, feature_names, df = build_features(records)

    if X is None:
        sys.exit("No usable records after cleaning. Check field names in your data.")

    pipe, metrics = fit_model(X, y, feature_names, cv=args.cv)

    if args.save_model:
        try:
            import joblib
        except ImportError:
            sys.exit("pip install joblib")
        args.save_model.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": pipe, "feature_names": feature_names, "metrics": metrics}, args.save_model)
        print(f"\nModel saved → {args.save_model}")

    print("\nTo score a bid:")
    print(f"  python3 fit_win_model.py --predict --discount 8.5 --category 'ก่อสร้าง' \\")
    print(f"    --load-model {args.save_model or 'output/win_model.joblib'}")


if __name__ == "__main__":
    main()
