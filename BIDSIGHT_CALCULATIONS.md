# BidSight Model: Core Calculations & Validation

> **Version 2 (corrected).** Removes win probability entirely. Replaces it with positioning percentile
> and an empirical competitiveness band. See correction rationale below.

---

## Why "Win Probability" Was Removed

Three problems with the original model:

1. **Data is winner-only.** Every row in `cgd_contracts` is an awarded tender — the winning bid.
   There are no losing bids. A CDF over winners tells you where a bid sits among past winners,
   not the probability it wins against an unknown pool of other bidders.

2. **The 0.875 calibration had no theoretical basis.** It was derived from a single observation
   (the model's 80th-percentile prediction covering 70% of outcomes) and then applied globally.
   Single-point calibration on winner-only data is not a valid procedure.

3. **Bidder count explains ~97% of outcome variance.** With bidder count unknowable at bid time,
   the out-of-time R² ceiling is ~0.03. No statistical model can estimate P(win) meaningfully
   without knowing how many firms will bid.

**What replaced it:** positioning percentile (empirical CDF) + competitiveness band (p10–p90).
These are honest claims about where a bid sits vs. historical winners. They do not claim to predict
P(win | bid).

---

## Part 1: Core Bid Recommendation Logic

### Input Parameters
```
refPrice        Reference price (ราคากลาง) in millions
costM           Estimated cost in millions
targetMarginPct Target profit margin % (default 10%)
benchmark       Optional: QuantileTable from buildBenchmarkTables()
```

### Step 1: Margin Guard
**Purpose:** Ensure the bid doesn't violate the margin floor.

```javascript
costRatio = costM / refPrice
marginMaxDiscount = (1 - costRatio / (1 - targetMarginPct/100)) × 100
cannotMeetMargin = marginMaxDiscount <= 0
```

**Example:**
- refPrice = ฿10M, costM = ฿8.2M (82%), targetMargin = 10%
- costRatio = 0.82
- marginMaxDiscount = (1 - 0.82 / 0.9) × 100 = 8.9%

If costs are too high, marginMaxDiscount ≤ 0 → **no profitable bid possible**.

### Step 2: Get Benchmark Quantile Table

**Fallback chain (priority order):**
```javascript
if (agency && category && agencyCategory.has(key)) {
  benchmark = agencyCategory[agency+"|"+category]
  source = "agency×category"           // fallbackUsed = false
} else if (province && category && provinceCategory.has(key)) {
  benchmark = provinceCategory[province+"|"+category]
  source = "province×category"         // fallbackUsed = true
} else if (category && category.has(projectType)) {
  benchmark = category[projectType]
  source = "category"                  // fallbackUsed = true
} else {
  benchmark = global
  source = "global"                    // fallbackUsed = true
}
```

`fallbackUsed = false` only when agency×category matches. All other tiers set `fallbackUsed = true`.

**QuantileTable fields:**
```javascript
{
  discounts: number[],          // sorted raw values — for empirical CDF
  p10, p25, median, p75, p90: number,
  sigma: number,                // stdev (informational only, not used in recommendations)
  n: number,
  source: string,
  // 95% CI on median (Conover order statistics, no distributional assumption — set when n ≥ 4)
  medianCI?: { lo: number; hi: number },
  // Market concentration (DOJ antitrust scale, set at category level when n ≥ 10 winner IDs)
  hhi?: number,                 // Herfindahl-Hirschman Index (0–10000)
  eNoc?: number,                // effective number of competitors = 10000 / HHI
  marketConcentrationN?: number,// number of winnerBusinessId values used
  // Competition density (CoST subset only — sparse)
  medianBidderCount?: number,
  bidderCountN?: number,
}
```

### Step 3: Choose Target Discount

```javascript
targetDiscount = cannotMeetMargin ? 0 : min(benchmark.median, marginMaxDiscount)
marginFloorBreached = !cannotMeetMargin && benchmark.median > marginMaxDiscount
```

Logic: bid at market median **or** margin floor, whichever is lower.
If margin floor is below market median, you're bidding above most past winners.

### Step 4: Calculate Recommended Bid

```javascript
bid = refPrice × (1 - targetDiscount / 100)
```

**Critical:** Anchor on **reference price** (ราคากลาง), not budget. The discount % is defined as:
```
discount = (refPrice - agreedPrice) / refPrice × 100
```

### Step 5: Positioning Percentile (replaces "win probability")

**Purpose:** Show where the recommended discount sits vs. comparable past winners.

```javascript
positioningPct = round(
  sorted(benchmark.discounts).filter(d => d <= targetDiscount).length
  / benchmark.discounts.length
  × 100
)
```

**Reading:** positioningPct = 60 means your bid discounts more than 60% of past winners. That is
**not** P(win) = 60%. It is a positioning statement.

**Positioning labels:**

| Range | Label | Thai |
|-------|-------|------|
| < 25th pct | soft | ราคาสูง (อ่อน) |
| 25–50th pct | conservative | ต่ำกว่าตลาด |
| 50–75th pct | competitive | ระดับตลาด |
| 75–90th pct | aggressive | เชิงรุก |
| > 90th pct | very_aggressive | เชิงรุกมาก |

### Step 6: Actual Margin

```javascript
actualMargin = cannotMeetMargin ? 0 : (bid - costM) / bid × 100
```

**Example:** bid=฿9.1M, cost=฿8.2M → margin = 9.89% ≈ 10%

---

## Part 2: Competitiveness Band

The band shows the spread of discounts among comparable past winners.
Use it to understand market dispersion, not to predict your outcome.

```javascript
band = {
  p10:    benchmark.p10,    // bottom decile — few winners discount this little
  p25:    benchmark.p25,    // first quartile
  median: benchmark.median, // typical winner
  p75:    benchmark.p75,    // third quartile
  p90:    benchmark.p90,    // top decile — winners who discounted most aggressively
}
```

**Rule of thumb:** Target discounts in the p25–p75 range to balance competitiveness and margin.
Below p25: you are above most past winners. Above p75: thinner margins, check the floor.

---

## Part 3: Benchmark Table Computation

**When:** API call on first request, then cached for 1 hour.

```javascript
// Matches competitive procurement methods by Thai name or English tag.
// Sole-source (เฉพาะเจาะจง) is excluded — no competition, so discounts are meaningless.
const COMPETITIVE_RE = /ประกวดราคา|คัดเลือก|e-bidding/i

function buildBenchmarkTables(contracts) {
  // Filter to competitive methods with valid discounts.
  // >= 0 includes zero-discount awards (real data); negatives are data errors.
  ebidding = contracts.filter(c =>
    COMPETITIVE_RE.test(c.procurementMethod ?? c.procurementMethodGroup ?? '') &&
    c.discountFromReference >= 0 &&
    c.discountFromReference < 100
  )

  // Group raw discounts by agency×category, province×category, and category
  for (contract of ebidding) {
    agCatMap[agency+"|"+projectType].push(contract.discountFromReference)
    provCatMap[province+"|"+projectType].push(contract.discountFromReference)
    catMap[projectType].push(contract.discountFromReference)
    catBusinessIds[projectType].push(contract.winnerBusinessId)   // for HHI
    if (contract.bidders?.length > 0) {
      catBidderCounts[projectType].push(contract.bidders.length)  // for density (CoST only)
    }
  }

  // Build QuantileTables — include raw sorted discounts for empirical CDF
  for ([key, vals] of agCatMap) {
    if (vals.length >= MIN_N) {  // MIN_N = 8
      agencyCategory[key] = computeQuantileTable(vals, "agency×category")
    }
  }
  for ([key, vals] of provCatMap) {
    if (vals.length >= MIN_N) {
      provinceCategory[key] = computeQuantileTable(vals, "province×category")
    }
  }
  for ([cat, vals] of catMap) {
    const qt   = computeQuantileTable(vals, "category")
    const conc = computeHHI(catBusinessIds[cat])          // undefined if n < 10
    const dens = computeDensity(catBidderCounts[cat])     // undefined if n < 5
    category[cat] = { ...qt, ...conc, ...dens }
  }

  global = computeQuantileTable(allDiscounts, "global")
  return { agencyCategory, provinceCategory, category, global }
}

function computeQuantileTable(discounts, source) {
  sorted = discounts.sort((a, b) => a - b)
  n = sorted.length
  mean = sum(sorted) / n
  variance = sum((x - mean)² for x in sorted) / n

  // Type 7 linear interpolation (pandas/numpy default).
  // h = (n-1) * p/100; result = sorted[floor(h)] + frac(h) * (sorted[ceil(h)] - sorted[floor(h)])
  // NOT nearest-rank (sorted[floor(n * p)]) — those differ at small n.
  function percentile(p) {
    const h  = (n - 1) * p / 100
    const lo = Math.floor(h)
    const hi = Math.min(lo + 1, n - 1)
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo])
  }

  return {
    discounts: sorted,          // raw — for empirical CDF
    p10:    percentile(10),
    p25:    percentile(25),
    median: percentile(50),
    p75:    percentile(75),
    p90:    percentile(90),
    sigma:  sqrt(variance),
    n,
    source
  }
}
```

---

## Part 4: Market Intelligence Signals

These are attached to the category-level (and propagated to the API response) as extra context.
They do not enter recommendation logic — they're display-only.

### 95% CI on the Median (`medianCI`)

Uses order statistics with normal approximation of the binomial (Conover 1999, §3.2).
No distributional assumption — reads directly from the sorted array.

```javascript
spread = 1.96 × √n / 2
j = max(0,   floor(n/2 - spread) - 1)
k = min(n-1, ceil(n/2  + spread) - 1)
medianCI = { lo: sorted[j], hi: sorted[k] }
```

A wide CI means sparse or dispersed data. Only computed when n ≥ 4.

### HHI and ENoc (`hhi`, `eNoc`)

```javascript
// Uses winnerBusinessId — unique juristic ID, no name-normalisation needed
counts = groupBy(winnerBusinessIds)
hhi  = sum((count_i / total)² for each winner) × 10000
eNoc = 10000 / hhi   // effective number of competitors
```

**DOJ/FTC thresholds:**
| HHI | Market structure |
|-----|-----------------|
| < 1500 | Competitive |
| 1500–2500 | Moderately concentrated |
| > 2500 | Highly concentrated |

Only computed when n ≥ 10 valid IDs.

### Competition Density (`medianBidderCount`)

```javascript
// bidders[] is present only in CoST-tagged contracts (--all-bidders flag)
bidderCounts = contracts.filter(c => c.bidders?.length > 0).map(c => c.bidders.length)
medianBidderCount = median(bidderCounts)  // computed when n ≥ 5
```

When present, this cross-checks ENoc (HHI-derived). When absent, ENoc is the sole proxy.

---

## Part 5: Bid Signals

Three raw signals — no composite score. Calibrating weights/thresholds requires loser
bid data that does not exist in `cgd_contracts` (winner-only dataset).

```javascript
// Signal 1: Margin viability (pure math)
// Note: when floor is breached, actualMargin = targetMarginPct exactly (by definition of the
// floor), so marginViability = 100. The strategic risk is expressed through Signal 2.
marginViability = cannotMeetMargin ? 0 : min(100, actualMargin / targetMarginPct × 100)

// Signal 2: Competitiveness (empirical CDF position)
competitiveness = marginFloorBreached
  ? round(positioningPct × 0.4)   // penalise: bid forced above market by cost floor
  : positioningPct

// Signal 3: Market volume (benchmark data richness, piecewise linear)
// n=8→30, n=20→50, n=50→70, n≥200→100
marketVolume = piecewiseLinear(n)
```

These are shown as three separate progress bars in the UI, not aggregated.

---

## Part 6: Forward-Walk Backtest

**Purpose:** Validate baseline model performance (MAE, R²) without data leakage.

### Setup

```javascript
contracts = ebidding.filter(valid).sortByAnnounceDate()
numFolds = 5
foldSize = floor(contracts.length / numFolds)
```

### Loop: Expanding Window

```javascript
for (fold = 0; fold < numFolds; fold++) {
  trainData = contracts[0 : fold * foldSize]          // all prior folds
  testData  = contracts[fold * foldSize : (fold+1) * foldSize]

  // Build benchmark from training data ONLY — no leakage
  trainMedian = median(trainData.map(c => c.discountFromReference))

  for (contract of testData) {
    predicted = trainMedian
    actual    = contract.discountFromReference
    errors.push(abs(predicted - actual))
  }

  mae  = mean(errors)
  rmse = sqrt(mean(errors²))
  r2   = 1 - (ssResidual / ssTotal)
}
```

### Expected Results

```
MAE ≈ 8.3pp   (correct baseline)
RMSE ≈ 9.6pp
R² ≈ 0.03     (correct — not a bug)
```

**Why R² ≈ 0.03:**
Bidder count explains ~97% of outcome variance. At bid time, bidder count is unknowable.
A median-only model correctly achieves ~3% R². If R² > 0.3, there is data leakage.

---

## Part 7: Backward Test (Per-Tender Validation)

**Purpose:** For each awarded contract, compare model recommendation vs. actual outcome.
Used for sanity checks, not for model tuning (would be circular — winners-only data).

```javascript
// Uses real Firestore data; tables built from full dataset (in-sample — forward-test handles OOT)
tables = buildBenchmarkTables(allContracts)

for (contract of testContracts) {
  estimatedCost = contract.referencePrice * 0.8   // assumed 80% cost ratio (no actual cost data)
  bench = getBenchmarkFromTables(contract.agency, contract.projectType, tables, contract.province)
  rec = recommendBid(contract.referencePrice, estimatedCost, targetMargin=10, bench)

  error = rec.recommendedDiscount - contract.discountFromReference
  // "wouldHaveWon" = our recommended bid ≤ actual winner's price.
  // Necessary but NOT sufficient for winning: we'd also need to beat every other bidder.
  wouldHaveWon = rec.recommendedBid <= contract.agreedPrice

  if (wouldHaveWon) {
    profitMargin = (contract.agreedPrice - estimatedCost) / contract.agreedPrice * 100
  }
}
```

**Observed results:**
- Average error: ~7–9pp (model predicts near category median; actual winners are higher-variance)
- Bid ≤ winner price rate: varies by category (conservative model beats winner price rarely)
- Profitable margin guard: ~100% (cost-floor check correctly blocks unprofitable bids)

**What changed from v1:**
- Uses real Firestore data, not synthetic contracts
- No `predictedWinProb` — removed entirely (winner-only data cannot calibrate win probability)
- Uses `positioningPct` + `positioningLabel` instead
- Benchmark lookup uses full fallback chain (agency×category → province×category → category → global)

---

## API Endpoint

**POST** `/api/recommend-bid`

**Request:**
```json
{
  "refPriceM": 10,
  "costM": 8.2,
  "targetMarginPct": 10,
  "agency": "optional agency name",
  "projectType": "optional category"
}
```

**Response:**
```json
{
  "recommendedBid": 9.1,
  "recommendedDiscount": 8.9,
  "marketMedianDiscount": 6.1,
  "expectedMargin": 10.0,
  "marginFloorBreached": false,
  "cannotMeetMargin": false,
  "positioningPct": 23,
  "positioningLabel": "soft",
  "positioningLabelTh": "ราคาสูง (อ่อน)",
  "positioningLabelEn": "Soft — below most winners, safe margin",
  "band": { "p10": 0.2, "p25": 0.8, "median": 6.1, "p75": 18.2, "p90": 32.0 },
  "comparableN": 29750,
  "scope": "global",
  "fallbackUsed": true,
  "benchmarkSource": "global",
  "note": "Positioning percentile is not a win probability. It shows where this bid sits relative to historical winners, not P(this bid wins). True win probability requires knowing how many firms will bid — which is unknowable at bid time."
}
```

**Interpretation of positioningPct = 23:**
Your bid is less aggressive than 77% of past winners. You will likely lose to more aggressive bidders.
To improve positioning, increase discount — but check marginFloorBreached.

---

## Constants

```javascript
GLOBAL_MEDIAN = 6.1       // p50 of 27,954 positive-discount e-bidding tenders (old value 18.5 was the p75)
GLOBAL_SIGMA  = 13.9      // stdev of discounts (informational)
MIN_N = 8                  // minimum bucket size before falling back to category/global
```

**Removed:**
- `CALIB = 0.875` — single-point shrink, no theoretical basis, removed
- `phi()` — normal CDF, removed (data is not normally distributed; empirical CDF is sufficient)

---

## Validation Summary

| Metric | Forward-Walk | Backward |
|--------|-------------|----------|
| MAE (pp) | 8.3 | 7.4 |
| RMSE (pp) | 9.6 | — |
| R² | 0.03 ✓ | — |
| Would-have-won rate | — | 13.3% |
| Profitable wins | — | ~100% |
| "Win prob accuracy" | removed | removed |

✓ R² ≈ 0.03 is correct and expected given winner-only data and unknowable bidder count.
