# BidSight — Bid Recommender + Walk-Forward Backtest (v2, data-corrected)

> Paste into your coding agent with the e-GP workbook available. This version reflects what
> the real data actually supports — not the original bidder-count model, which doesn't survive
> contact with the data (see "Hard data facts" below).

You are building a bid-recommendation engine for **BidSight** on Thai government e-GP tenders.
These are lowest-price ("e-bidding") auctions: the winner is the lowest bid, and
`discount = (reference_price − agreed_price) / reference_price`.

## Hard data facts (verified — design around these, don't fight them)
- The workbook's main sheet has ~52,600 real tender rows (the rest are blank padding).
- The competitive universe is **e-bidding only: ~29,750 rows** with a usable discount.
  Direct-award methods (`เฉพาะเจาะจง`) barely discount (median 0%) — exclude them.
- **Discount is measured against the REFERENCE PRICE (`ราคากลาง`), not the budget.** Anchor
  every bid calculation on reference price.
- **Bidder count exists for only ~617 rows (~1.2%) AND is unknowable before bidding.** Do NOT
  build the model on bidder count. Use it only as an after-the-fact validation slice.
- **Bid data is winner-only.** The loser column holds names, not bid amounts. There are NO
  observed losing bids anywhere, so you cannot train or validate a literal win/loss classifier.
- Announcement dates (`วันที่ประกาศ`) are Thai Buddhist-era strings like `10 ส.ค. 63`
  (space-separated, BE year). Parse: CE = (2500 + 2-digit year) − 543. They span ~2020–2025,
  concentrated in 2024.

## Expected result (so you know if you're on track)
A walk-forward baseline on this data gives out-of-time **R² ≈ 0.03** and MAE ≈ 8.7 discount
points — barely better than an agency×category historical-median lookup. That's correct, not a
bug: the only strong predictor (how many firms show up) is unknowable at bid time. So the
deliverable is a **calibrated range / competitiveness band**, not a precise point prediction.
If you find yourself reporting R² > 0.3 out-of-time, you have leakage — stop and find it.

## Step 0 — Audit
Confirm the schema, the e-bidding row count, the discount denominator (reference price), and the
date parsing. Report back before modelling.

## Step 1 — Anti-leakage feature contract
Pre-bid features only: reference_price (log), category, agency, province/district,
month/quarter, and trailing aggregates (agency mean/median discount, category median) computed
**only from tenders dated before the current one**. High-cardinality agency/district →
smoothed target encoding fit on the training slice only. Never use bidder count or agreed price.

## Step 2 — Benchmark = empirical quantiles (replaces the OLS + bidder table)
For each tender profile, compute historical winning-discount quantiles
(q10/q25/q50/q75/q90) over comparable tenders, with fallback
`agency×category → category → global` (require n ≥ 8 to use a bucket). The target discount for a
desired win rate is the matching historical quantile. Optionally fit a HistGradientBoosting
quantile regressor (sklearn, `loss='quantile'`) at τ=0.5/0.8 as well, but expect it to only
marginally beat the quantile lookup — keep the transparent lookup as the default.

## Step 3 — Walk-forward backtest
Sort by announcement date. Expanding-window folds (train on all prior dates, test on the next
block). Refit trailing encodings per fold on the training slice. Report per-fold MAE / RMSE / R²
vs. two baselines: (a) global median, (b) agency×category trailing median. Also report
**quantile coverage**: does the τ=0.8 prediction actually sit above ~80% of realized discounts?
(In testing it covered ~70% — slightly optimistic — so apply a calibration shrink, below.)

## Step 4 — Corrected calculation formulas
Implement exactly these (the originals had bugs noted in `[FIX]`):

1. `margin_max_discount = (1 − cost/reference_price / (1 − target_margin/100)) × 100`
   Largest discount that still keeps target margin. Return "cannot meet margin" if ≤ 0. *(correct)*
2. `bid = reference_price × (1 − final_discount/100)`
   `[FIX] anchor on reference_price, not budget.`
   `final_discount = min(benchmark_quantile_discount, margin_max_discount)`.
3. `win_prob = Φ((your_discount − median_discount) / sigma)`, clamped to [0.03, 0.97].
   `[FIX]` The original used a Gaussian *bell* (`exp(−0.5 z²)`), which wrongly makes win
   probability *fall* when you discount harder. Use the normal **CDF Φ** — monotonic increasing.
   Apply calibration shrink toward 0.5: `p = Φ(z) × 0.875 + 0.5 × 0.125` (from the 0.70/0.80
   coverage gap). `sigma` = stdev of discount in the comparable bucket.
4. `actual_margin = (bid − cost) / bid × 100` *(correct — margin on revenue)*.
5. `[FIX] delete peakWin` (`min(88, (100/competitors)×1.3)`) — needs the unknowable bidder count
   and uses unjustified magic numbers. Win prob now comes from the quantile/CDF instead.

## Step 5 — Core output: competitiveness band
The primary per-tender result is a band, not a single number:
```
{ your_discount_pct, your_percentile, label,
  band: { p10, p25, median, p75, p90 },
  comparable_n, scope }            # scope = which fallback bucket was used
```
`your_percentile` = fraction of comparable historical winners at or below your discount.
Label by percentile: <25 soft / 25–50 below median / 50–75 competitive / 75–90 aggressive /
>90 very aggressive (check margin). Plus `recommend_bid(reference_price, cost, profile,
target_margin_pct, target_win_prob)` returning bid, discount, predicted win prob, expected
margin, and the margin-floor / cannot-meet-margin flags.

## Step 6 — Deliverables
Rerunnable pipeline (parse → features → benchmark tables → walk-forward report → inference),
the fold-level scorecard vs. baselines, the quantile coverage number, and the two functions
above. Short readout: how much (if anything) the GBM beats the median lookup, and a clear
statement that win prob is a structural estimate (no observed losing bids) to be read as a band.

## Guardrails
- e-bidding only; discount off reference price; no bidder count, no agreed price in features.
- All trailing aggregates from the past only; walk-forward, never a random split.
- Winner-only data → no win/loss classifier; win prob is structural.
- Start at Step 0 and confirm the schema before building.
