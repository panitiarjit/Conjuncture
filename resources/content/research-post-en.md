# The Reference Price Is Not the Market Price: What 20,000 Thai Government Contracts Reveal

**Conjuncture | June 2025**

---

We analyzed 20,000 completed procurement contracts from Thailand's e-GP system, covering 1,117 agencies and over ฿1 trillion in contract value, to answer one simple question:

**How well do government reference prices reflect real market prices?**

The answer is more surprising than expected.

---

## 36% of competitive contracts: winner barely beats the reference price

Of 16,304 contracts awarded through e-bidding (open competition), **5,885 contracts (36.1%)** saw the winner bid within 1% of the reference price. That means more than a third of "competitive" procurement produced the same outcome as a fixed-price purchase.

The comparison is stark: **direct-selection contracts (เฉพาะเจาะจง) have a median discount of exactly 0%.** E-bidding sits at 5.42%. That 5.42 percentage point gap is the measured value of competitive pressure in Thai government procurement — but it only materializes about two-thirds of the time.

---

## Same country, same law — 120× price gap between provinces

When we ranked provinces by median discount, the spread was remarkable:

| Province | Median discount | Contracts |
|----------|----------------|-----------|
| Saraburi | 0.09% | 273 |
| Mae Hong Son | 0.14% | 50 |
| Yasothon | 0.17% | 122 |
| **Phichit** | **10.91%** | 163 |
| Samut Songkhram | 10.26% | 39 |
| Pathum Thani | 5.94% | 300 |

Saraburi and Phichit follow the same procurement law. But winners in Phichit discount 120× more relative to reference price than winners in Saraburi. This isn't noise — it reflects the underlying contractor market structure in each region.

---

## 57% of agencies bought from only one vendor

Of 4,003 agencies with winner data, **2,275 (56.83%)** had a single winning vendor across all their analyzed contracts.

This doesn't automatically signal collusion. Small agencies in remote areas simply have fewer qualified contractors. But combined with near-zero discounts, it creates a pattern worth examining. When one vendor consistently wins at 0% discount, the reference price is essentially the agreed price before the process begins.

---

## Project type as a predictor of competition

| Project type | Median discount | Count |
|-------------|----------------|-------|
| Design work | 15.00% | 23 |
| Construction | 2.40% | 8,034 |
| Procurement (goods) | 0.78% | 6,662 |
| Services / contract work | 0.08% | 4,523 |

Design contracts are the most price-competitive. Service contracts are barely competitive at all. This aligns with intuition: service specifications often implicitly define the provider, eliminating meaningful price competition.

---

## When anomalies become extreme

We flagged 812 contracts with Z-scores above 3 compared to their agency's own typical discount distribution. The extremes:

**Department of Rural Roads (Samut Prakan):** Reference price ฿19.2M. Winner discounted 51% — 8.7 standard deviations below the agency's median. Z-score: 8.70.

**State Railway of Thailand:** Supervision contract for Khon Kaen–Nong Khai double-track railway. Reference price ฿604M. Winner discounted 81.48%. Z-score: 7.73.

**The ceiling case:** A subdistrict administrative organization's road construction contract. Reference price ฿46.1M. Contract price: ฿461,000. **Discount: 99%.**

Extreme discounts have two readings: either the reference price was grossly inflated, or the contractor intentionally bid below cost to secure the project. Both warrant scrutiny.

---

## What this analysis cannot tell you

The e-GP database records only winners, not losers. We cannot calculate win probability from this data alone. The discount percentile we show in the BidSight Simulator tells you "where past winners bid" — not "what discount you need to win."

This gap is exactly why we built the Network Effect Loops. As users report their own bid outcomes (won and lost), the model will accumulate matched pairs and estimate real win probability. The first gate triggers at 30 matched pairs per category — we're building toward it now.

---

## The full dataset

These 20,000 contracts are the first we've made public. The full database contains 153,000+ contracts, updated daily from e-GP. The BidSight Simulator at conjuncture.work lets you place yourself on the discount curve for any of 40+ procurement categories.

If you've submitted a government bid recently — won, lost, or walked away — [reporting the outcome](/report) takes 90 seconds and directly improves the model's accuracy for everyone in your category.

---

*Methodology: 20,000 contracts sampled from the cgd_contracts Firestore collection. Filtered to contracts with valid reference and agreed prices: 19,773 usable records. Discounts calculated as percentage reduction from reference price. Anomaly detection uses agency-level Z-scores (discount vs. agency median/σ). Provincial and project-type aggregations use median discount across all valid contracts in that group.*
