"""
BidSight core model — Python port of lib/bidsight-core.ts.

Identical math, same constants, same fallback chain.
Use this for offline analysis, notebooks, or building a Python API
without touching the TypeScript source.

Usage:
    from bidsight_core import build_benchmark_tables, recommend_bid

    tables = build_benchmark_tables(contracts)   # contracts: list[dict]
    result = recommend_bid(
        ref_price=10.0,
        cost_m=8.2,
        target_margin_pct=10.0,
        benchmark=tables.category.get("ก่อสร้าง"),
        target_position_pct=50,
    )
    print(result.recommended_bid, result.positioning_pct)
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional

# ── Global fallback constants ────────────────────────────────────────────────
# Computed from 27,954 positive-discount e-bidding tenders.
GLOBAL_MEDIAN  = 6.1
GLOBAL_SIGMA   = 13.9
MIN_N          = 8       # minimum bucket size before falling back
CALIB_ALPHA    = 2       # Beta prior pseudo-count per side
DECAY_FACTOR   = 0.75    # recency weight: per fiscal year of age


# ── Data structures ──────────────────────────────────────────────────────────

@dataclass
class QuantileTable:
    discounts:    list[float]
    weights:      list[float]
    total_weight: float
    weighted_n:   int
    p10:    float
    p25:    float
    median: float
    p75:    float
    p90:    float
    sigma:  float
    n:      int
    source: str
    median_ci:              Optional[tuple[float, float]] = None
    hhi:                    Optional[float] = None
    e_noc:                  Optional[float] = None
    market_concentration_n: Optional[int]   = None
    median_bidder_count:    Optional[float] = None
    bidder_count_n:         Optional[int]   = None
    q4_median:              Optional[float] = None
    q4_n:                   Optional[int]   = None


@dataclass
class CategoryBudgetTierData:
    boundaries: tuple[float, float, float]   # p25/p50/p75 of refPrice
    tiers:      tuple[QuantileTable, QuantileTable, QuantileTable, QuantileTable]


@dataclass
class BenchmarkTables:
    agency_category:      dict[str, QuantileTable]
    province_category:    dict[str, QuantileTable]
    category:             dict[str, QuantileTable]
    category_budget_tier: dict[str, CategoryBudgetTierData]
    global_table:         QuantileTable


@dataclass
class BidScore:
    margin_viability: int   # 0–100
    competitiveness:  int   # 0–100
    market_volume:    int   # 0–100
    rationale:        str


@dataclass
class BidRecommendation:
    recommended_bid:       float
    recommended_discount:  float
    market_median_discount:float
    expected_margin:       float
    margin_floor_breached: bool
    cannot_meet_margin:    bool
    positioning_pct:       int
    positioning_label:     str
    positioning_label_th:  str
    positioning_label_en:  str
    band_p10:   float
    band_p25:   float
    band_median:float
    band_p75:   float
    band_p90:   float
    comparable_n:     int
    scope:            str
    fallback_used:    bool
    benchmark_source: str
    bid_signals:      BidScore
    note:             str


# ── Positioning labels ───────────────────────────────────────────────────────

_LABEL_TH = {
    "soft":           "ราคาสูง (อ่อน)",
    "conservative":   "ต่ำกว่าตลาด",
    "competitive":    "ระดับตลาด",
    "aggressive":     "เชิงรุก",
    "very_aggressive":"เชิงรุกมาก",
}

_LABEL_EN = {
    "soft":           "Soft — below most winners, safe margin",
    "conservative":   "Conservative — below median",
    "competitive":    "Competitive — around the typical winning range",
    "aggressive":     "Aggressive — strong positioning, thinner margin",
    "very_aggressive":"Very aggressive — top decile, check margin",
}


def positioning_label(pct: int) -> str:
    if pct < 25: return "soft"
    if pct < 50: return "conservative"
    if pct < 75: return "competitive"
    if pct < 90: return "aggressive"
    return "very_aggressive"


# ── CDF helpers ──────────────────────────────────────────────────────────────

def _percentile(sorted_vals: list[float], p: float) -> float:
    if not sorted_vals:
        return 0.0
    h  = (len(sorted_vals) - 1) * p / 100
    lo = int(h)
    hi = min(lo + 1, len(sorted_vals) - 1)
    return sorted_vals[lo] + (h - lo) * (sorted_vals[hi] - sorted_vals[lo])


def _weighted_percentile(
    sorted_discounts: list[float],
    weights: list[float],
    total_weight: float,
    p: float,
) -> float:
    if not sorted_discounts:
        return 0.0
    target = p / 100 * total_weight
    cum_w  = 0.0
    for i, (d, w) in enumerate(zip(sorted_discounts, weights)):
        prev   = cum_w
        cum_w += w
        if cum_w >= target:
            if i == 0 or prev == target:
                return d
            frac = (target - prev) / w
            return sorted_discounts[i - 1] + frac * (d - sorted_discounts[i - 1])
    return sorted_discounts[-1]


def _calibrated_pct(
    discounts:    list[float],
    weights:      Optional[list[float]],
    total_weight: Optional[float],
    target:       float,
) -> int:
    if not discounts:
        return 50
    if weights and total_weight:
        w_below = sum(w for d, w in zip(discounts, weights) if d <= target)
        return round((w_below + CALIB_ALPHA) / (total_weight + 2 * CALIB_ALPHA) * 100)
    below = sum(1 for d in discounts if d <= target)
    return round((below + CALIB_ALPHA) / (len(discounts) + 2 * CALIB_ALPHA) * 100)


# ── Quantile table builder ───────────────────────────────────────────────────

def _compute_weighted_quantile_table(
    entries: list[tuple[float, float]],   # (discount, weight)
    source:  str,
) -> QuantileTable:
    if not entries:
        return QuantileTable(
            discounts=[], weights=[], total_weight=0, weighted_n=0,
            p10=0, p25=0, median=GLOBAL_MEDIAN, p75=0, p90=0,
            sigma=GLOBAL_SIGMA, n=0, source=source,
        )

    sorted_entries = sorted(entries, key=lambda e: e[0])
    discounts      = [e[0] for e in sorted_entries]
    weights        = [e[1] for e in sorted_entries]
    n              = len(sorted_entries)
    total_w        = sum(weights)

    sum_w_sq  = sum(w * w for w in weights)
    weighted_n = round(total_w ** 2 / sum_w_sq)

    mean     = sum(d * w for d, w in zip(discounts, weights)) / total_w
    variance = sum(w * (d - mean) ** 2 for d, w in zip(discounts, weights)) / total_w

    median_ci: Optional[tuple[float, float]] = None
    if weighted_n >= 4:
        spread = 1.96 * math.sqrt(weighted_n) / 2
        j_pct  = max(0.0,   ((math.floor(weighted_n / 2 - spread) - 1) / weighted_n) * 100)
        k_pct  = min(100.0, ((math.ceil(weighted_n  / 2 + spread) - 1) / weighted_n) * 100)
        median_ci = (
            round(_weighted_percentile(discounts, weights, total_w, j_pct) * 10) / 10,
            round(_weighted_percentile(discounts, weights, total_w, k_pct) * 10) / 10,
        )

    def wp(p: float) -> float:
        return round(_weighted_percentile(discounts, weights, total_w, p) * 10) / 10

    return QuantileTable(
        discounts=discounts, weights=weights,
        total_weight=total_w, weighted_n=weighted_n,
        p10=wp(10), p25=wp(25), median=wp(50), p75=wp(75), p90=wp(90),
        sigma=round(math.sqrt(variance) * 10) / 10,
        n=n, source=source, median_ci=median_ci,
    )


# ── HHI & competition density ────────────────────────────────────────────────

def _compute_hhi(ids: list[Optional[str]]) -> Optional[tuple[float, float, int]]:
    valid = [x.strip() for x in ids if x]
    if len(valid) < 10:
        return None
    counts: dict[str, int] = {}
    for x in valid:
        counts[x] = counts.get(x, 0) + 1
    n   = len(valid)
    hhi = round(sum((c / n) ** 2 for c in counts.values()) * 10000)
    e_noc = round(10000 / hhi * 10) / 10
    return hhi, e_noc, n


def _compute_density(bidder_counts: list[int]) -> Optional[tuple[float, int]]:
    valid = [c for c in bidder_counts if c > 0]
    if len(valid) < 5:
        return None
    s = sorted(valid)
    mid = len(s) // 2
    median = s[mid] if len(s) % 2 else round((s[mid - 1] + s[mid]) / 2)
    return float(median), len(valid)


# ── Fiscal quarter helper ────────────────────────────────────────────────────

def _fiscal_q(announce_date: str) -> Optional[int]:
    try:
        d = datetime.fromisoformat(announce_date[:10])
    except (ValueError, TypeError):
        return None
    m = d.month
    if m >= 10: return 1
    if m >= 7:  return 4
    if m >= 4:  return 3
    return 2


# ── Competitive method filter ─────────────────────────────────────────────────

_COMPETITIVE_RE = re.compile(r"ประกวดราคา|คัดเลือก|e-bidding", re.IGNORECASE)


# ── Main table builder ────────────────────────────────────────────────────────

def build_benchmark_tables(
    contracts: list[dict],
    current_fy: Optional[int] = None,
) -> BenchmarkTables:
    """
    Build all benchmark lookup tables from a list of contract dicts.

    Each dict should have at minimum:
        procurement_method / procurement_method_group : str
        discount_from_reference : float
        project_type : str

    Optional but recommended:
        agency, province, winner_business_id, bidders (list),
        fiscal_year (int), reference_price (float), announce_date (str ISO)

    Returns a BenchmarkTables object with .category, .agency_category, etc.
    """
    def _method(c: dict) -> str:
        return c.get("procurementMethod") or c.get("procurement_method") or \
               c.get("procurementMethodGroup") or c.get("procurement_method_group") or ""

    ebidding = [
        c for c in contracts
        if _COMPETITIVE_RE.search(_method(c))
        and c.get("discountFromReference") is not None or c.get("discount_from_reference") is not None
        and 0 <= (c.get("discountFromReference") or c.get("discount_from_reference") or -1) < 100
    ]

    def _discount(c: dict) -> float:
        return c.get("discountFromReference") or c.get("discount_from_reference") or 0.0

    def _project_type(c: dict) -> str:
        return c.get("projectType") or c.get("project_type") or ""

    max_fy = current_fy or max(
        (c.get("fiscalYear") or c.get("fiscal_year") or 0 for c in ebidding),
        default=0,
    ) or 2569

    def _weight(c: dict) -> float:
        fy = c.get("fiscalYear") or c.get("fiscal_year")
        if not fy:
            return 1.0
        age = min(max_fy - fy, 7)
        return DECAY_FACTOR ** age

    ag_cat_map:        dict[str, list[tuple[float, float]]] = {}
    prov_cat_map:      dict[str, list[tuple[float, float]]] = {}
    cat_map:           dict[str, list[tuple[float, float]]] = {}
    cat_ebidding_map:  dict[str, list[dict]]               = {}
    cat_biz_ids:       dict[str, list[Optional[str]]]      = {}
    cat_bidder_counts: dict[str, list[int]]                = {}
    cat_q4_discounts:  dict[str, list[float]]              = {}
    cat_ref_prices:    dict[str, list[float]]              = {}

    for c in ebidding:
        disc  = _discount(c)
        ptype = _project_type(c)
        w     = _weight(c)
        entry = (disc, w)

        agency   = c.get("agency") or c.get("department")
        province = c.get("province")
        biz_id   = c.get("winnerBusinessId") or c.get("winner_business_id")
        bidders  = c.get("bidders") or []
        ref_p    = c.get("referencePrice") or c.get("reference_price") or c.get("budget")
        ann_date = c.get("announceDate") or c.get("announce_date") or c.get("announcement_date")

        if agency:
            k = f"{agency}|{ptype}"
            ag_cat_map.setdefault(k, []).append(entry)

        if province:
            k = f"{province}|{ptype}"
            prov_cat_map.setdefault(k, []).append(entry)

        cat_map.setdefault(ptype, []).append(entry)
        cat_ebidding_map.setdefault(ptype, []).append(c)
        cat_biz_ids.setdefault(ptype, []).append(biz_id)

        if bidders:
            cat_bidder_counts.setdefault(ptype, []).append(len(bidders))

        if ann_date and _fiscal_q(str(ann_date)) == 4:
            cat_q4_discounts.setdefault(ptype, []).append(disc)

        if ref_p and ref_p > 0:
            cat_ref_prices.setdefault(ptype, []).append(float(ref_p))

    # Agency × category
    agency_category: dict[str, QuantileTable] = {}
    for k, vals in ag_cat_map.items():
        if len(vals) >= MIN_N:
            agency_category[k] = _compute_weighted_quantile_table(vals, "agency×category")

    # Province × category
    province_category: dict[str, QuantileTable] = {}
    for k, vals in prov_cat_map.items():
        if len(vals) >= MIN_N:
            province_category[k] = _compute_weighted_quantile_table(vals, "province×category")

    # Category (with HHI, density, Q4)
    category: dict[str, QuantileTable] = {}
    for cat, vals in cat_map.items():
        qt   = _compute_weighted_quantile_table(vals, "category")
        conc = _compute_hhi(cat_biz_ids.get(cat, []))
        dens = _compute_density(cat_bidder_counts.get(cat, []))

        q4_disc = cat_q4_discounts.get(cat, [])
        q4_median: Optional[float] = None
        if len(q4_disc) >= 5:
            q4_sorted = sorted(q4_disc)
            q4_median = round(_percentile(q4_sorted, 50) * 10) / 10

        qt.hhi                    = conc[0] if conc else None
        qt.e_noc                  = conc[1] if conc else None
        qt.market_concentration_n = conc[2] if conc else None
        qt.median_bidder_count    = dens[0] if dens else None
        qt.bidder_count_n         = dens[1] if dens else None
        qt.q4_median              = q4_median
        qt.q4_n                   = len(q4_disc) if q4_disc else None
        category[cat] = qt

    # Category × budget tier
    category_budget_tier: dict[str, CategoryBudgetTierData] = {}
    for cat, ref_prices in cat_ref_prices.items():
        if len(ref_prices) < 4 * MIN_N:
            continue
        s_ref = sorted(ref_prices)
        b1, b2, b3 = _percentile(s_ref, 25), _percentile(s_ref, 50), _percentile(s_ref, 75)
        tier_entries: list[list[tuple[float, float]]] = [[], [], [], []]

        for c in cat_ebidding_map.get(cat, []):
            rp = c.get("referencePrice") or c.get("reference_price") or c.get("budget")
            if not rp or rp <= 0:
                continue
            entry = (_discount(c), _weight(c))
            idx   = 0 if rp <= b1 else 1 if rp <= b2 else 2 if rp <= b3 else 3
            tier_entries[idx].append(entry)

        if any(len(t) < MIN_N for t in tier_entries):
            continue

        category_budget_tier[cat] = CategoryBudgetTierData(
            boundaries=(round(b1 * 100) / 100, round(b2 * 100) / 100, round(b3 * 100) / 100),
            tiers=(
                _compute_weighted_quantile_table(tier_entries[0], "category×tier1"),
                _compute_weighted_quantile_table(tier_entries[1], "category×tier2"),
                _compute_weighted_quantile_table(tier_entries[2], "category×tier3"),
                _compute_weighted_quantile_table(tier_entries[3], "category×tier4"),
            ),
        )

    # Global
    all_entries = [(_discount(c), _weight(c)) for c in ebidding]
    global_table = (
        _compute_weighted_quantile_table(all_entries, "global")
        if all_entries
        else _compute_weighted_quantile_table([(GLOBAL_MEDIAN, 1.0)], "global-fallback")
    )

    return BenchmarkTables(
        agency_category=agency_category,
        province_category=province_category,
        category=category,
        category_budget_tier=category_budget_tier,
        global_table=global_table,
    )


def get_benchmark_from_tables(
    tables:   BenchmarkTables,
    agency:   Optional[str] = None,
    category: Optional[str] = None,
    province: Optional[str] = None,
    ref_price: Optional[float] = None,
) -> tuple[QuantileTable, bool]:
    """
    Fallback chain (most → least specific):
      agency×category → province×category → category×tier → category → global

    Returns (QuantileTable, fallback_used).
    """
    if agency and category:
        t = tables.agency_category.get(f"{agency}|{category}")
        if t:
            return t, False

    if province and category:
        t = tables.province_category.get(f"{province}|{category}")
        if t:
            return t, True

    if ref_price is not None and category:
        tier_data = tables.category_budget_tier.get(category)
        if tier_data:
            b1, b2, b3 = tier_data.boundaries
            idx = 0 if ref_price <= b1 else 1 if ref_price <= b2 else 2 if ref_price <= b3 else 3
            t = tier_data.tiers[idx]
            if t and t.n >= MIN_N:
                return t, True

    if category:
        t = tables.category.get(category)
        if t:
            return t, True

    return tables.global_table, True


# ── Bid score ────────────────────────────────────────────────────────────────

def _volume_signal(n: int) -> int:
    if n >= 200: return 100
    if n >= 50:  return round(70 + (n - 50)  / 150 * 30)
    if n >= 20:  return round(50 + (n - 20)  / 30  * 20)
    if n >= 8:   return round(30 + (n - 8)   / 12  * 20)
    return 20


def compute_bid_score(
    cannot_meet_margin:    bool,
    margin_floor_breached: bool,
    expected_margin:       float,
    positioning_pct:       int,
    comparable_n:          int,
    target_margin_pct:     float,
    e_noc:                 Optional[float] = None,
) -> BidScore:
    margin_viability = (
        0 if cannot_meet_margin
        else min(100, round(expected_margin / max(target_margin_pct, 1) * 100))
    )
    competitiveness = (
        round(positioning_pct * 0.4) if margin_floor_breached
        else positioning_pct
    )
    market_volume = _volume_signal(comparable_n)

    if cannot_meet_margin:
        rationale = "Cost structure cannot support a profitable bid at any competitive discount."
    elif margin_floor_breached:
        rationale = (
            f"Margin floor is below market median — bid sits above {100 - positioning_pct}% "
            f"of past winners. Winning requires an incumbency or technical advantage price cannot compensate for."
        )
    elif competitiveness < 30:
        rationale = (
            f"Bid sits below {positioning_pct}% of past winners — pricing is soft. "
            f"If this reflects your true cost floor, winning requires a non-price advantage."
        )
    else:
        rationale = (
            f"Margin viable at {positioning_pct}th-pct positioning "
            f"against {comparable_n} comparable contracts."
        )

    if e_noc is not None and e_noc < 4 and not cannot_meet_margin:
        n_players = round(e_noc)
        rationale += (
            f" Market is concentrated (eNoc {e_noc} — effectively "
            f"{n_players} dominant player{'s' if n_players != 1 else ''}); "
            f"expect at least one aggressive bidder near the top of the discount range."
        )

    return BidScore(
        margin_viability=margin_viability,
        competitiveness=competitiveness,
        market_volume=market_volume,
        rationale=rationale,
    )


# ── Main recommendation ──────────────────────────────────────────────────────

def recommend_bid(
    ref_price:          float,
    cost_m:             float,
    target_margin_pct:  float = 10.0,
    benchmark:          Optional[QuantileTable] = None,
    target_position_pct:float = 50.0,
) -> BidRecommendation:
    """
    Core bid recommendation.

    Args:
        ref_price:           Reference price in any consistent unit (millions THB recommended).
        cost_m:              Estimated cost in the same unit.
        target_margin_pct:   Target gross margin floor (%).
        benchmark:           QuantileTable for the relevant category/tier.
                             If None, falls back to global constants.
        target_position_pct: Target CDF position (0–100). 50 = market median.

    Returns:
        BidRecommendation with all fields populated.
    """
    cost_ratio = cost_m / ref_price
    margin_max_discount     = (1 - cost_ratio / (1 - target_margin_pct / 100)) * 100
    cannot_meet_margin      = margin_max_discount <= 0

    bench       = benchmark
    bench_median = bench.median if bench else GLOBAL_MEDIAN
    source       = bench.source if bench else "global"
    sorted_d     = bench.discounts if bench else []
    weights      = bench.weights   if bench else None
    total_w      = bench.total_weight if bench else None

    if sorted_d:
        bench_target = (
            _weighted_percentile(sorted_d, weights, total_w, target_position_pct)
            if weights and total_w
            else _percentile(sorted_d, target_position_pct)
        )
    else:
        bench_target = bench_median

    target_discount       = 0.0 if cannot_meet_margin else min(bench_target, margin_max_discount)
    margin_floor_breached = not cannot_meet_margin and bench_target > margin_max_discount

    bid           = ref_price * (1 - target_discount / 100)
    actual_margin = 0.0 if cannot_meet_margin else (bid - cost_m) / bid * 100

    pos_pct      = _calibrated_pct(sorted_d, weights, total_w, target_discount)
    label        = positioning_label(pos_pct)
    rounded_margin = round(actual_margin * 10) / 10
    comparable_n   = bench.n if bench else 0

    bid_signals = compute_bid_score(
        cannot_meet_margin=cannot_meet_margin,
        margin_floor_breached=margin_floor_breached,
        expected_margin=rounded_margin,
        positioning_pct=pos_pct,
        comparable_n=comparable_n,
        target_margin_pct=target_margin_pct,
        e_noc=bench.e_noc if bench else None,
    )

    return BidRecommendation(
        recommended_bid=       round(bid * 10) / 10,
        recommended_discount=  round(target_discount * 10) / 10,
        market_median_discount=bench_median,
        expected_margin=       rounded_margin,
        margin_floor_breached= margin_floor_breached,
        cannot_meet_margin=    cannot_meet_margin,
        positioning_pct=       pos_pct,
        positioning_label=     label,
        positioning_label_th=  _LABEL_TH[label],
        positioning_label_en=  _LABEL_EN[label],
        band_p10=    bench.p10    if bench else 0,
        band_p25=    bench.p25    if bench else 0,
        band_median= bench.median if bench else GLOBAL_MEDIAN,
        band_p75=    bench.p75    if bench else 0,
        band_p90=    bench.p90    if bench else 0,
        comparable_n=    comparable_n,
        scope=           source,
        fallback_used=   benchmark is None,
        benchmark_source=source,
        bid_signals=     bid_signals,
        note=(
            "Positioning percentile is not a win probability. "
            "It shows where this bid sits relative to historical winners, "
            "not P(this bid wins). True win probability requires knowing how many "
            "firms will bid — which is unknowable at bid time."
        ),
    )


# ── Curve from band knots (display / plotting) ───────────────────────────────

def build_curve_from_band(
    p10: float, p25: float, median: float, p75: float, p90: float,
    n: int = 17,
) -> list[dict]:
    """
    Approximate win-CDF from five quantile knots.
    Returns list of {"disc": float, "position_pct": float}.
    Useful for plotting the win curve without the full discount array.
    """
    max_disc = max(p90 * 1.15, median * 2.5, 30)
    knots = [
        (0,      1),
        (p10,   10),
        (p25,   25),
        (median,50),
        (p75,   75),
        (p90,   90),
        (max_disc, 99),
    ]

    def _interp_pct(disc: float) -> float:
        for i in range(len(knots) - 1):
            d0, p0 = knots[i]
            d1, p1 = knots[i + 1]
            if d0 <= disc <= d1:
                t = (disc - d0) / (d1 - d0) if d1 != d0 else 0
                return round(p0 + t * (p1 - p0))
        return 99 if disc >= max_disc else 1

    points = []
    for i in range(n + 1):
        disc = max_disc * i / n
        points.append({"disc": round(disc * 10) / 10, "position_pct": _interp_pct(disc)})
    return points
