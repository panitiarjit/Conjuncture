# Anomaly Report: Statistical Outliers in Thai Government Procurement
**Conjuncture | June 2025 | Based on 20,000 contracts, FY2561–2568**

---

## Methodology

For each agency with ≥10 contracts, we computed the median discount and standard deviation. A contract is flagged as an anomaly when its discount falls more than 3 standard deviations (Z > 3) from that agency's own median. This controls for agencies that legitimately operate in high-discount markets.

**Total anomalies detected: 812** (of 19,773 valid contracts)
- Positive Z (winner discounted far more than typical): 804
- Negative Z (winner discounted far less than typical): 8

The 8 negative anomalies (contracts where the winner paid more than usual) are more operationally interesting — they suggest the reference price was set unusually low, or the agency had no competitive bids.

---

## Top Anomalies by Z-Score

| Agency | Project type | Reference price | Discount | Z-score |
|--------|-------------|----------------|----------|---------|
| กรมทางหลวงชนบท | Construction | ฿19.2M | 51.0% | 8.70 |
| กองทัพบก | Procurement | ฿29.7M | 72.4% | 7.95 |
| การรถไฟแห่งประเทศไทย | Supervision | ฿604.0M | 81.5% | 7.73 |
| กรมสรรพากร | Procurement | ฿4.9M | 82.7% | 7.42 |
| สำนักงานปลัดกระทรวงสาธารณสุข | Medical equipment | ฿6.2M | 87.3% | 6.84 |
| กรมทางหลวง | Construction | ฿16.1M | 50.6% | 6.75 |
| โรงพยาบาลนครพิงค์ | Pharmaceutical | ฿3.9M | 83.5% | 6.57 |
| กรมโยธาธิการและผังเมือง | Consulting | ฿30.0M | 80.0% | 6.48 |
| การประปาส่วนภูมิภาค | Procurement | ฿23.6M | 95.7% | 6.06 |
| กองทัพอากาศ | Pharmaceutical | ฿40.0M | 93.6% | 5.73 |

---

## Pattern: Military and Hospital Pharmaceutical Procurement

Four of the top 20 anomalies involve hospitals or military units buying pharmaceuticals. The pattern: agency median discount is typically 0–1% (nearly all drug contracts are won at reference price), but individual contracts see 80–95% discounts.

Two explanations are consistent with the data:
1. **Bulk joint-purchasing:** When agencies consolidate drug purchases across departments, larger volumes attract steeper discounts. A single large contract can look like an outlier against the agency's typical small-lot purchases.
2. **Reference price miscalibration:** Drug reference prices in Thailand are set by committee and updated infrequently. For off-patent drugs where competition has intensified, the reference price may be 5–10× the current market price.

Neither explanation requires wrongdoing. Both suggest the reference price mechanism needs more frequent recalibration for pharmaceutical procurement.

---

## Pattern: Road Construction at 50%+ Discounts

Three road construction anomalies appear in the top 10 (กรมทางหลวงชนบท, กรมทางหลวง × 2). Construction agencies typically show 0–3% median discounts, so 50%+ is extreme.

These contracts share a characteristic: they are in the ฿15–20M range (mid-tier), not the largest projects. Large projects (>฿100M) in road construction tend toward lower discounts (median 1.74% in the >฿10M tier), possibly because fewer contractors can execute them. Mid-tier projects attract more bidders, increasing competition — but a 50% discount still exceeds typical competition levels.

---

## The Extreme Cases: 95–99% Discounts

Five contracts in the dataset show discounts above 95%:

| Agency | Reference price | Contract price | Discount |
|--------|----------------|---------------|---------|
| อบต.เสมา | ฿46.1M | ฿461,000 | 99.0% |
| กรมการแพทย์ (ยาตา 7 รายการ) | ฿185.0M | ฿2.8M | 98.5% |
| การไฟฟ้าส่วนภูมิภาค | ฿31.0M | ฿631,407 | 98.0% |
| ศูนย์พัฒนาเด็กเล็ก (อาหารกลางวัน) | ฿308,700 | ฿8,078 | 97.4% |
| การประปาส่วนภูมิภาค | ฿23.6M | ฿1.0M | 95.7% |

The **อบต.เสมา** road construction case is structurally unusual: the reference price of ฿46.1M for a concrete road in a subdistrict is far above what comparable projects cost (median ฿1–5M for similar work). The contract price of ฿461,000 is more consistent with market rates. This suggests the reference price was set incorrectly by a factor of ~100, not that the contractor is building the road for free.

The **กรมการแพทย์** eye medication case (฿185M → ฿2.8M) is consistent with joint bulk procurement of off-patent drugs where generic competition has driven prices down significantly since the reference price was last updated.

The **ศูนย์พัฒนาเด็กเล็ก** cases (school lunch catering, ฿35.90/child/day reference vs. actual ~฿5.50) likely reflect a standard per-head reference price being multiplied by an incorrectly large headcount in the system.

---

## What These Anomalies Are Not

These 812 flagged contracts are **statistical outliers, not confirmed fraud.** Each has a plausible non-malicious explanation. Z-score analysis is a screening tool, not a finding.

The value of this analysis is prioritization: if an oversight body has capacity to review 50 contracts, these 812 (and especially the top 20) are more likely to yield findings than a random sample.

---

## How to Use This Data

Conjuncture makes anomaly detection available through the `/report` community reporting page. If you have direct knowledge of any of these contracts — you bid on them, you worked on them, or you know the agency — reporting what you know takes 2 minutes and creates a verifiable record.

Community reports that reach 5+ independent submissions for the same agency are automatically flagged in our `crowd_anomalies` collection for follow-up.
