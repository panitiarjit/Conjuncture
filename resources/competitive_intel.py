"""
Competitive Intelligence module for BidSight.

Data reality (from inspecting REAL TENDER LISTS.xlsx):
  - E-bidding rows (29,857): winner TIN and winner name are 0% populated.
    Near-ceiling rate and mean discount are the primary competitive signals.
  - HHI IS computable, but from the AllBidders sheet (winner company names
    parsed from ผู้แพ้ (CoST) text). Covers ~3.6% of e-bidding tenders.
  - Direct-award rows (13,489): cleanly separated as เฉพาะเจาะจง in
    วิธีจัดซื้อ (กลุ่ม). Used for yearend_direct_flag.
  - Dates are Thai Buddhist-era strings like '22-ธ.ค.-58'. pd.to_datetime
    will not parse these — use parse_thai_date() provided here.

Usage:
    data = load_intel_data('REAL TENDER LISTS.xlsx')
    cs   = competition_score('กรมชลประทาน', 'จ้างก่อสร้าง',
                             data['ebidding'], bidders_df=data['all_bidders'])
    ms   = market_summary('กรมชลประทาน', 'จ้างก่อสร้าง',
                          data['ebidding'], bidders_df=data['all_bidders'])
    ye   = yearend_direct_flag(data['direct'])
"""

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# Column renames: XLSX Thai headers → English aliases
# Used by load_intel_data() only; raw sheets keep Thai column names.
# ---------------------------------------------------------------------------
_RENAME = {
    'ราคากลาง (บาท)':      'ref_price',
    'ประเภท':              'category',
    'หน่วยงาน':            'agency',
    'ส่วนลด (%)':          'discount',
    'เลขนิติบุคคล':        'winner_tin',
    'จำนวนผู้เสนอราคา':    'n_bidders',
    'วิธีจัดซื้อ (กลุ่ม)': 'method_group',
    'วันที่ประกาศ':         'announce_date',
}

# Column name config for the renamed DataFrame used by competition functions
COL = {
    'agency':        'agency',
    'category':      'category',
    'discount':      'discount',
    'winner_tin':    'winner_tin',
    'n_bidders':     'n_bidders',
    'method_group':  'method_group',
    'announce_date': 'announce_date',
}

DIRECT_AWARD     = 'เฉพาะเจาะจง'
EBIDDING_METHOD  = 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)'
_BIDDER_MIN_CONF = 10   # n_bidders_valid below this flags bidder stats as low_confidence

# Thai month abbreviations → month number
_TH_MONTHS = {
    'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4,
    'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.':  8,
    'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
}


# ---------------------------------------------------------------------------
# Date utilities
# ---------------------------------------------------------------------------

def parse_thai_date(s) -> 'pd.Timestamp | None':
    """Parse Thai Buddhist-era date strings to pd.Timestamp.

    Handles two formats found in REAL TENDER LISTS.xlsx:
      Dash-separated: '22-ธ.ค.-58'   (วันที่ประกาศ in e-bidding rows)
      Space-separated: '3 มี.ค. 68'  (วันที่เกิดรายการ in direct-award rows)

    YY is a 2-digit Buddhist Era year; CE = 1957 + YY (e.g. 58 → 2015, 68 → 2025).
    Returns None for '-', NaN, or unparseable strings.
    """
    if not isinstance(s, str):
        return None
    s = s.strip()
    if s in ('-', ''):
        return None

    # Try both separators
    if '-' in s:
        parts = s.split('-')
    else:
        parts = s.split()

    if len(parts) != 3:
        return None
    day_s, month_th, year_2d_s = parts
    month = _TH_MONTHS.get(month_th.strip())
    if month is None:
        return None
    try:
        year_ce = 1957 + int(year_2d_s)
        return pd.Timestamp(year=year_ce, month=month, day=int(day_s))
    except (ValueError, OverflowError):
        return None


def parse_thai_dates(series: pd.Series) -> pd.Series:
    """Vectorised wrapper for parse_thai_date over a Series."""
    return series.map(parse_thai_date)


# ---------------------------------------------------------------------------
# Data loader
# ---------------------------------------------------------------------------

def load_intel_data(xlsx_path: str = 'REAL TENDER LISTS.xlsx') -> dict:
    """Load all sheets needed for competitive intelligence.

    Returns a dict:
      'ebidding'    — renamed e-bidding DataFrame (for discount/pricing analysis)
      'direct'      — raw direct-award rows with Thai column names (for yearend flag)
      'all_bidders' — AllBidders sheet: one row per bidder per project, with Won/Lost
      'full'        — full raw Lists sheet (Thai column names, unfiltered)
    """
    xl = pd.ExcelFile(xlsx_path)
    full = xl.parse('Lists')

    ebidding = (
        full[full['วิธีจัดซื้อ (กลุ่ม)'] == EBIDDING_METHOD]
        .copy()
        .rename(columns=_RENAME)
    )
    ebidding['category'] = ebidding['category'].fillna('NA')
    ebidding['agency']   = ebidding['agency'].fillna('NA')

    direct = full[full['วิธีจัดซื้อ (กลุ่ม)'] == DIRECT_AWARD].copy()

    all_bidders = xl.parse('AllBidders')

    return {
        'ebidding':    ebidding,
        'direct':      direct,
        'all_bidders': all_bidders,
        'full':        full,
    }


# ---------------------------------------------------------------------------
# 1. Row-level bid-ratio flag
# ---------------------------------------------------------------------------

def bid_ratio_flag(row: pd.Series) -> dict:
    """bid_ratio = agreed_price / ref_price, derived as 1 - discount/100.
    near_ceiling = True when ratio > 0.95 (discount < 5%).
    """
    d = row[COL['discount']]
    if pd.isna(d):
        return {'bid_ratio': None, 'near_ceiling': None}
    ratio = 1.0 - float(d) / 100.0
    return {'bid_ratio': round(ratio, 4), 'near_ceiling': bool(ratio > 0.95)}


def _near_ceiling(df: pd.DataFrame) -> pd.Series:
    return (1.0 - df[COL['discount']] / 100.0) > 0.95


# ---------------------------------------------------------------------------
# 2. Agency × category competitive intensity
# ---------------------------------------------------------------------------

def competition_score(agency: str, category: str, df: pd.DataFrame,
                      bidders_df: pd.DataFrame = None) -> dict:
    """Competitive intensity metrics for an agency × category pair.

    Parameters
    ----------
    df          : renamed e-bidding DataFrame (from load_intel_data()['ebidding'])
    bidders_df  : AllBidders sheet (from load_intel_data()['all_bidders']).
                  Required for HHI calculation. Without it, winner_hhi = None.

    Returns
    -------
    dict with: n_tenders, mean_discount, near_ceiling_rate, winner_hhi,
               hhi_n (tenders used for HHI), mean_bidders, n_bidders_valid,
               low_competition_rate, bidders_low_confidence.

    Data note: for e-bidding data, winner_hhi is computed from AllBidders winner
    names and covers only ~3.6% of tenders. mean_bidders covers ~2% of tenders.
    """
    sub = df[(df[COL['agency']] == agency) & (df[COL['category']] == category)]
    n_total = len(sub)
    if n_total == 0:
        return {
            'agency': agency, 'category': category, 'n_tenders': 0,
            'error': 'no data for this agency×category pair',
        }

    # n_bidders stats — extremely sparse (~2% of e-bidding rows)
    col_b = COL['n_bidders']
    if col_b in sub.columns:
        valid             = sub[col_b].dropna()
        n_valid           = int(len(valid))
        mean_bidders      = round(float(valid.mean()), 2) if n_valid > 0 else None
        low_comp_rate     = round(float((valid < 3).mean()), 3) if n_valid > 0 else None
        bidders_low_conf  = n_valid < _BIDDER_MIN_CONF
    else:
        n_valid, mean_bidders, low_comp_rate, bidders_low_conf = 0, None, None, True

    mean_discount     = round(float(sub[COL['discount']].mean()), 2)
    near_ceiling_rate = round(float(_near_ceiling(sub).mean()), 3)

    # HHI from AllBidders sheet (winner company names)
    hhi, hhi_n = None, 0
    if bidders_df is not None:
        ab_sub = bidders_df[
            (bidders_df['หน่วยงาน'] == agency) &
            (bidders_df['ประเภท']   == category) &
            (bidders_df['Won/Lost'] == 'Won')
        ]
        hhi_n = int(len(ab_sub))
        if hhi_n > 0:
            counts = ab_sub['Company'].value_counts()
            shares = counts / counts.sum()
            hhi    = round(float((shares ** 2).sum()), 4)
    else:
        # Fallback: winner_tin column (0% populated for e-bidding data)
        col_t = COL['winner_tin']
        if col_t in sub.columns:
            counts = sub[col_t].dropna().value_counts()
            if len(counts) > 0:
                shares = counts / counts.sum()
                hhi    = round(float((shares ** 2).sum()), 4)
                hhi_n  = int(counts.sum())

    return {
        'agency':               agency,
        'category':             category,
        'n_tenders':            n_total,
        'mean_discount':        mean_discount,
        'near_ceiling_rate':    near_ceiling_rate,
        'winner_hhi':           hhi,
        'hhi_n':                hhi_n,   # tenders with identified winner (HHI basis)
        'mean_bidders':         mean_bidders,
        'n_bidders_valid':      n_valid,
        'low_competition_rate': low_comp_rate,
        'bidders_low_confidence': bidders_low_conf,
    }


# ---------------------------------------------------------------------------
# 3. Incumbent dominance
# ---------------------------------------------------------------------------

def incumbent_flag(agency: str, category: str, company_name: str,
                   bidders_df: pd.DataFrame) -> dict:
    """Assess a specific company's dominance in an agency × category pair.

    Uses AllBidders sheet (winner company names) rather than TIN, since TIN
    is not populated in e-bidding data.

    Parameters
    ----------
    company_name : exact string from AllBidders['Company'] for the target firm
    bidders_df   : AllBidders sheet from load_intel_data()['all_bidders']
    """
    sub = bidders_df[
        (bidders_df['หน่วยงาน'] == agency) &
        (bidders_df['ประเภท']   == category)
    ]
    total_tenders  = sub['ชื่อโครงการ'].nunique()
    if total_tenders == 0:
        return {'company': company_name, 'n_tenders': 0,
                'error': 'no bidder data for this agency×category pair in AllBidders sheet'}

    winners = sub[sub['Won/Lost'] == 'Won']
    inc     = winners[winners['Company'] == company_name]
    win_rate = round(len(inc) / total_tenders, 3)
    is_dominant = bool(win_rate > 0.5)

    return {
        'company':     company_name,
        'wins':        int(len(inc)),
        'n_tenders':   total_tenders,
        'win_rate':    win_rate,
        'is_dominant': is_dominant,
        'note': (
            'win_rate = wins / unique projects in AllBidders for this agency×category. '
            'AllBidders covers ~3.6% of e-bidding tenders.'
        ),
    }


# ---------------------------------------------------------------------------
# 4. Fiscal year-end direct-award flag
# ---------------------------------------------------------------------------

def yearend_direct_flag(direct_df: pd.DataFrame) -> dict:
    """Flag direct-award (เฉพาะเจาะจง) tenders announced in Aug–Sep.

    Aug–Sep = Thai government fiscal year-end (FY closes 30 Sep).
    Clusters of sole-source awards in this window indicate year-end budget
    rush spending.

    Parameters
    ----------
    direct_df : the เฉพาะเจาะจง rows, i.e. load_intel_data()['direct'].
                Must contain the Thai column 'วันที่ประกาศ' in the format
                'DD-ThaiMonthAbbr-YY' (e.g. '19-ก.ย.-60').

    Returns
    -------
    dict with n_direct_total, n_yearend, yearend_rate,
    and 'flagged_df' (copy of direct_df with yearend_direct bool column added).
    """
    n_direct = len(direct_df)
    if n_direct == 0:
        return {
            'n_direct_total': 0, 'n_yearend': 0, 'yearend_rate': None,
            'flagged_df': direct_df.copy(),
            'note': 'no เฉพาะเจาะจง rows found — pass load_intel_data()["direct"]',
        }

    # วันที่ประกาศ is '-' for all direct-award rows in this dataset.
    # วันที่เกิดรายการ (transaction date) has 100% coverage and the same
    # Thai date format — use it as the primary date source.
    DATE_COLS = ['วันที่เกิดรายการ', 'วันที่ประกาศ', COL['announce_date']]
    col_d = next((c for c in DATE_COLS if c in direct_df.columns), None)
    if col_d is None:
        return {'error': 'no usable date column found in direct_df'}

    raw_dates = direct_df[col_d].replace('-', None)
    dates     = pd.to_datetime(parse_thai_dates(raw_dates), errors='coerce')
    n_unparsed = int(dates.isna().sum())
    if dates.isna().all():
        return {
            'n_direct_total': n_direct, 'n_yearend': 0, 'yearend_rate': 0.0,
            'flagged_df': direct_df.copy(),
            'note': f"All dates unparseable in column '{col_d}'. Sample: {direct_df[col_d].dropna().head(3).tolist()}",
        }
    mask      = dates.dt.month.isin([8, 9])
    flagged   = direct_df.copy()
    flagged['yearend_direct'] = mask.values
    n_yearend = int(mask.sum())

    return {
        'n_direct_total': n_direct,
        'n_yearend':      n_yearend,
        'yearend_rate':   round(n_yearend / n_direct, 3),
        'n_date_unparsed': n_unparsed,
        'date_column_used': col_d,
        'flagged_df':     flagged,
    }


# ---------------------------------------------------------------------------
# 5. Aggregate market summary
# ---------------------------------------------------------------------------

def market_summary(agency: str, category: str, df: pd.DataFrame,
                   bidders_df: pd.DataFrame = None) -> dict:
    """Combined competitive intelligence for an agency × category pair.

    Strategy thresholds (antitrust-aligned):
      'avoid'      — HHI > 0.4 AND near_ceiling_rate > 0.5
      'defensive'  — HHI > 0.25 OR near_ceiling_rate > 0.5
      'aggressive' — everything else

    When HHI is unavailable (bidders_df not provided or pair not in AllBidders),
    strategy is determined by near_ceiling_rate alone.

    Parameters
    ----------
    df          : renamed e-bidding DataFrame
    bidders_df  : AllBidders sheet — required for HHI; omit to skip concentration analysis
    """
    cs = competition_score(agency, category, df, bidders_df=bidders_df)
    if 'error' in cs:
        return cs

    # Top 3 incumbents from AllBidders (winner names for this agency×category)
    top_incumbents = []
    if bidders_df is not None:
        # Use all rows (Won + Lost) to count unique projects covered by AllBidders,
        # then filter to Won for the company tally. Consistent with incumbent_flag().
        ab_sub_all = bidders_df[
            (bidders_df['หน่วยงาน'] == agency) &
            (bidders_df['ประเภท']   == category)
        ]
        ab_sub = ab_sub_all[ab_sub_all['Won/Lost'] == 'Won']
        ab_total = int(ab_sub_all['ชื่อโครงการ'].nunique()) if len(ab_sub_all) > 0 else 1
        if len(ab_sub) > 0:
            top3 = (
                ab_sub['Company'].value_counts().head(3)
                .rename_axis('company').reset_index(name='wins')
            )
            # Divide by AllBidders-covered projects, not full dataset n_tenders.
            # Using n_tenders (full dataset) would understate win_rate by ~28x
            # since AllBidders covers only ~3.6% of e-bidding tenders.
            top3['win_rate'] = (top3['wins'] / max(ab_total, 1)).round(3)
            top_incumbents   = top3.to_dict('records')

    hhi = cs.get('winner_hhi')
    ncr = cs.get('near_ceiling_rate', 0.0)

    if hhi is not None and hhi > 0.4 and ncr > 0.5:
        strategy = 'avoid'
        top_pct  = f"{top_incumbents[0]['win_rate']*100:.0f}%" if top_incumbents else 'unknown'
        rationale = (
            f"Highly captured market: HHI {hhi:.2f} (antitrust threshold: 0.25), "
            f"{ncr*100:.0f}% of tenders close near reference price. "
            f"Incumbent wins {top_pct} of identified contracts. "
            "Recommend avoiding unless you have a relationship advantage."
        )
    elif hhi is None:
        if ncr > 0.5:
            strategy  = 'defensive'
            rationale = (
                f"No winner-identity data for HHI. "
                f"Near-ceiling rate {ncr*100:.0f}% suggests low genuine competition — "
                "price aggressively or build incumbent relationships before entering."
            )
        else:
            strategy  = 'aggressive'
            rationale = (
                f"Near-ceiling rate {ncr*100:.0f}% is low; mean discount {cs['mean_discount']:.1f}%. "
                "No winner-identity data, but discount distribution suggests open competition."
            )
    elif hhi > 0.25 or ncr > 0.5:
        strategy  = 'defensive'
        rationale = (
            f"Elevated concentration: HHI {hhi:.2f}, {ncr*100:.0f}% near-ceiling, "
            f"mean discount {cs['mean_discount']:.1f}%. "
            "Winnable, but incumbent players are entrenched. Price aggressively and target newer contracts."
        )
    else:
        strategy  = 'aggressive'
        rationale = (
            f"Open market: HHI {hhi:.2f}, mean discount {cs['mean_discount']:.1f}%, "
            f"{ncr*100:.0f}% near-ceiling rate. Bid at or above market median discount."
        )

    hhi_coverage = (
        f"HHI computed from {cs['hhi_n']} identified winners "
        f"({cs['hhi_n']/cs['n_tenders']*100:.1f}% of {cs['n_tenders']} tenders)."
        if cs['hhi_n'] > 0
        else "HHI not available — no winner identity data for this pair."
    )

    return {
        **cs,
        'top_incumbents':   top_incumbents,
        'strategy':         strategy,
        'rationale':        rationale,
        'hhi_coverage_note': hhi_coverage,
    }
