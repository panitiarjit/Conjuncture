"""
BidSight — corrected bid-recommendation model.

Built from the real e-bidding data (29,747 tenders). Key corrections vs. the old model:
  1. Benchmark discount comes from empirical quantiles of similar tenders,
     NOT from an OLS on bidder count (bidder count is unknowable pre-bid).
  2. Everything is anchored on the REFERENCE PRICE (ราคากลาง), not the budget,
     because that is the denominator the discount % is actually computed against.
  3. Win probability is a MONOTONIC CDF, not a Gaussian bell — discounting harder
     can never lower your modelled win chance.
  4. Margin guard and actual-margin formulas kept (they were correct) but clamped.
"""
import numpy as np, pandas as pd
from math import erf, sqrt

# ---------------------------------------------------------------------------
# Fit empirical benchmark tables from history (leakage note: in production,
# refit these only on tenders dated before the one you are pricing).
# ---------------------------------------------------------------------------
QS = [0.1, 0.25, 0.5, 0.75, 0.8, 0.9]

def fit_tables(csv='ebidding.csv'):
    d = pd.read_csv(csv)
    d = d[(d.ref_price > 0)].copy()
    d.category = d.category.fillna('NA'); d.agency = d.agency.fillna('NA')
    def qtab(keys):
        g = d.groupby(keys).discount
        t = g.quantile(QS).unstack()
        t.columns = [f'q{int(q*100)}' for q in QS]
        t['n'] = g.size(); t['sigma'] = g.std()
        return t
    return {
        'agency_cat': qtab(['agency', 'category']),
        'category':   qtab(['category']),
        'global':     {'q': d.discount.quantile(QS).to_dict(),
                       'sigma': d.discount.std(), 'median': d.discount.median()},
        '_df': d[['agency', 'category', 'discount']],   # raw rows for percentile lookups
    }

def _phi(z):                       # standard normal CDF
    return 0.5 * (1 + erf(z / sqrt(2)))

# Out-of-time calibration measured in the backtest: the model's nominal 80th
# percentile actually covered ~70% of real outcomes. So modelled win prob is
# slightly optimistic; shrink it toward 0.5 to be honest.
CALIB = 0.70 / 0.80   # ≈ 0.875

def benchmark(profile, tables, target_win_prob=0.6):
    """Return (target_discount, median_discount, sigma, source) for a tender profile.
    target_discount = the historical discount quantile matching your desired win prob."""
    a, c = profile.get('agency', 'NA'), profile.get('category', 'NA')
    row, src = None, None
    if (a, c) in tables['agency_cat'].index and tables['agency_cat'].loc[(a, c), 'n'] >= 8:
        row, src = tables['agency_cat'].loc[(a, c)], 'agency×category'
    elif c in tables['category'].index:
        row, src = tables['category'].loc[c], 'category'
    if row is not None:
        median, sigma = row['q50'], (row['sigma'] if not np.isnan(row['sigma']) else 12.0)
        qcols = {0.1:'q10',0.25:'q25',0.5:'q50',0.75:'q75',0.8:'q80',0.9:'q90'}
        # pick the historical quantile closest to the requested win prob
        nearest = min(qcols, key=lambda q: abs(q - target_win_prob))
        target = row[qcols[nearest]]
    else:
        g = tables['global']; median, sigma = g['median'], g['sigma']
        target = np.interp(target_win_prob, QS, [g['q'][q] for q in QS]); src = 'global'
    return float(target), float(median), float(sigma), src

# ---------------------------------------------------------------------------
# Corrected core formulas
# ---------------------------------------------------------------------------
def margin_max_discount(cost, ref_price, target_margin_pct):
    """Largest discount you can give and still keep >= target margin (margin-on-revenue).
    Returns None if you cannot meet the margin at ANY winning price."""
    cost_ratio = cost / ref_price
    mmd = (1 - cost_ratio / (1 - target_margin_pct / 100)) * 100
    return mmd if mmd > 0 else None

def win_prob(your_discount, median_discount, sigma):
    """Monotonic-increasing win probability. Bidding the median discount ~= 50%;
    bidding above it raises your chance; below it lowers it. Calibrated & clamped."""
    z = (your_discount - median_discount) / max(sigma, 1e-6)
    p = _phi(z) * CALIB + 0.5 * (1 - CALIB)   # shrink toward 0.5 per backtest
    return float(min(0.97, max(0.03, p)))

def actual_margin(bid, cost):
    return (bid - cost) / bid * 100

def recommend_bid(ref_price, cost, profile, tables,
                  target_margin_pct=10.0, target_win_prob=0.6):
    target_disc, median, sigma, src = benchmark(profile, tables, target_win_prob)
    mmd = margin_max_discount(cost, ref_price, target_margin_pct)

    floor_breached = mmd is not None and target_disc > mmd
    no_profitable_bid = mmd is None
    # never discount past the margin floor
    final_disc = target_disc if mmd is None else min(target_disc, mmd)
    if mmd is None:
        final_disc = 0.0

    bid = ref_price * (1 - final_disc / 100)          # anchored on REFERENCE PRICE
    return {
        'recommended_bid': round(bid, 2),
        'recommended_discount_pct': round(final_disc, 2),
        'market_median_discount_pct': round(median, 2),
        'benchmark_source': src,
        'predicted_win_prob': round(win_prob(final_disc, median, sigma), 2),
        'expected_margin_pct': round(actual_margin(bid, cost), 2),
        'margin_floor_breached': bool(floor_breached),
        'cannot_meet_margin': bool(no_profitable_bid),
        'note': 'win prob is a structural estimate (no observed losing bids); treat as a range.'
    }

def competitiveness_band(your_discount, profile, tables, min_n=8):
    """Show where a candidate discount sits in the distribution of comparable
    historical winning discounts. Returns the band, the bid's empirical percentile,
    and a plain-language label. This is the core per-tender BidSight output."""
    df = tables['_df']
    a, c = profile.get('agency', 'NA'), profile.get('category', 'NA')
    sub = df[(df.agency == a) & (df.category == c)]
    scope = f'this agency + {c}'
    if len(sub) < min_n:
        sub = df[df.category == c]; scope = f'all {c} tenders'
    if len(sub) < min_n:
        sub = df; scope = 'all e-bidding tenders'
    arr = sub.discount.values
    pct = float((arr <= your_discount).mean() * 100)
    q = lambda p: float(np.percentile(arr, p))
    if   pct < 25: label = 'soft — below market, easy margin, low win odds'
    elif pct < 50: label = 'below median — conservative'
    elif pct < 75: label = 'competitive — around the typical winning range'
    elif pct < 90: label = 'aggressive — strong win odds, thinner margin'
    else:          label = 'very aggressive — top decile, check margin floor'
    return {
        'your_discount_pct': round(your_discount, 2),
        'your_percentile': round(pct),                 # e.g. 72 -> harder than 72% of past winners
        'label': label,
        'band': {'p10': round(q(10), 1), 'p25': round(q(25), 1),
                 'median': round(q(50), 1), 'p75': round(q(75), 1),
                 'p90': round(q(90), 1)},
        'comparable_n': int(len(arr)),
        'scope': scope,
    }



if __name__ == '__main__':
    T = fit_tables()
    # Example: a ฿2.0M construction tender, our cost ฿1.6M, want 70% chance to win.
    profile = {'agency': 'กรุงเทพมหานคร', 'category': 'จ้างก่อสร้าง'}
    import json
    rec = recommend_bid(2_000_000, 1_600_000, profile, T,
                        target_margin_pct=8, target_win_prob=0.7)
    print(json.dumps(rec, ensure_ascii=False, indent=2))
    print('\n--- competitiveness band for the recommended discount ---')
    band = competitiveness_band(rec['recommended_discount_pct'], profile, T)
    print(json.dumps(band, ensure_ascii=False, indent=2))
