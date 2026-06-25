/**
 * Autonomous data exploration script for Conjuncture content generation.
 * Pulls two 10k pages from cgd_contracts, computes findings, saves JSON.
 * One-time run — 20k Firestore reads, within free-tier buffer.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { AwardedContract } from '../lib/types';

// ── Firebase init ─────────────────────────────────────────────────────────────

function getDb(): Firestore {
  const existing = getApps().find((a) => a.name === 'explore');
  if (existing) return getFirestore(existing);

  const projectId   = process.env.FIREBASE_ADMIN_PROJECT_ID!;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL!;
  const privateKey  = (process.env.FIREBASE_ADMIN_PRIVATE_KEY ?? '')
    .replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').trim();

  const app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'explore');
  return getFirestore(app);
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadContracts(db: Firestore, limit: number): Promise<AwardedContract[]> {
  const PAGE = 500;
  const results: AwardedContract[] = [];
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;

  while (results.length < limit) {
    const remaining = limit - results.length;
    let q = db.collection('cgd_contracts').orderBy('__name__').limit(Math.min(PAGE, remaining));
    if (lastDoc) q = q.startAfter(lastDoc) as typeof q;
    const snap = await q.get();
    for (const doc of snap.docs) results.push(doc.data() as AwardedContract);
    if (snap.docs.length < PAGE || snap.docs.length === 0) break;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (results.length % 2000 === 0) process.stdout.write(`  loaded ${results.length}...\n`);
  }
  return results;
}

// ── Statistics helpers ────────────────────────────────────────────────────────

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

function mean(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length);
}

function percentile(arr: number[], p: number): number {
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(p / 100 * (s.length - 1));
  return s[Math.min(idx, s.length - 1)];
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

// ── Main analysis ─────────────────────────────────────────────────────────────

async function main() {
  const db = getDb();

  console.log('Loading cgd_contracts (target: 20,000 records)...');
  const all = await loadContracts(db, 20_000);
  console.log(`Loaded ${all.length} contracts.\n`);

  // Only work with contracts that have valid discount data
  const COMPETITIVE_RE = /ประกวดราคา|คัดเลือก|e-bidding/i;

  const valid = all.filter(
    (c) =>
      c.discountFromReference != null &&
      c.discountFromReference >= 0 &&
      c.discountFromReference < 100 &&
      c.referencePrice != null &&
      c.referencePrice > 0 &&
      c.agency,
  );

  const competitive = valid.filter((c) => COMPETITIVE_RE.test(c.procurementMethod ?? ''));

  console.log(`Valid (have discount): ${valid.length}`);
  console.log(`Competitive (e-bidding/คัดเลือก): ${competitive.length}\n`);

  // ── FINDING 1: Agency-level discount analysis ────────────────────────────────
  console.log('=== FINDING 1: Agency discount profiles ===');

  const agencyMap = new Map<string, number[]>();
  for (const c of valid) {
    if (!agencyMap.has(c.agency)) agencyMap.set(c.agency, []);
    agencyMap.get(c.agency)!.push(c.discountFromReference!);
  }

  type AgencyStat = {
    agency: string;
    n: number;
    medianDiscount: number;
    meanDiscount: number;
    stddev: number;
    min: number;
    max: number;
    p25: number;
    p75: number;
  };

  const agencyStats: AgencyStat[] = [];
  for (const [agency, discounts] of agencyMap.entries()) {
    if (discounts.length < 3) continue; // need min 3 for meaningful stats
    agencyStats.push({
      agency,
      n: discounts.length,
      medianDiscount: round2(median(discounts)),
      meanDiscount: round2(mean(discounts)),
      stddev: round2(stddev(discounts)),
      min: round2(Math.min(...discounts)),
      max: round2(Math.max(...discounts)),
      p25: round2(percentile(discounts, 25)),
      p75: round2(percentile(discounts, 75)),
    });
  }

  agencyStats.sort((a, b) => b.n - a.n);

  // Widest spread between agencies
  const agenciesByMedian = [...agencyStats].filter(a => a.n >= 10).sort((a, b) => a.medianDiscount - b.medianDiscount);
  const lowestMedian  = agenciesByMedian.slice(0, 5);
  const highestMedian = agenciesByMedian.slice(-5).reverse();

  console.log('\nLowest median discount agencies (min 10 contracts):');
  lowestMedian.forEach(a => console.log(`  ${a.agency.slice(0, 50).padEnd(50)} n=${a.n} median=${a.medianDiscount}%`));
  console.log('\nHighest median discount agencies (min 10 contracts):');
  highestMedian.forEach(a => console.log(`  ${a.agency.slice(0, 50).padEnd(50)} n=${a.n} median=${a.medianDiscount}%`));

  // Highest variance agencies (tightest: consistent low variance)
  const highVarianceAgencies = [...agencyStats].filter(a => a.n >= 10).sort((a, b) => b.stddev - a.stddev).slice(0, 5);
  const lowVarianceAgencies  = [...agencyStats].filter(a => a.n >= 10).sort((a, b) => a.stddev - b.stddev).slice(0, 5);
  console.log('\nHighest variance agencies (unpredictable markets):');
  highVarianceAgencies.forEach(a => console.log(`  ${a.agency.slice(0, 50).padEnd(50)} stddev=${a.stddev}%`));
  console.log('\nLowest variance agencies (most predictable markets):');
  lowVarianceAgencies.forEach(a => console.log(`  ${a.agency.slice(0, 50).padEnd(50)} stddev=${a.stddev}%`));

  // ── FINDING 2: Vendor concentration ─────────────────────────────────────────
  console.log('\n=== FINDING 2: Vendor concentration per agency ===');

  const agencyVendorMap = new Map<string, Map<string, number>>();
  for (const c of valid) {
    if (!c.winnerName) continue;
    if (!agencyVendorMap.has(c.agency)) agencyVendorMap.set(c.agency, new Map());
    const vendorMap = agencyVendorMap.get(c.agency)!;
    vendorMap.set(c.winnerName, (vendorMap.get(c.winnerName) ?? 0) + 1);
  }

  let singleVendorAgencies = 0;
  let totalAgenciesWithVendors = 0;
  type ConcentrationStat = {
    agency: string;
    totalContracts: number;
    uniqueVendors: number;
    topVendor: string;
    topVendorWins: number;
    topVendorShare: number;
  };
  const concentrationStats: ConcentrationStat[] = [];

  for (const [agency, vendorMap] of agencyVendorMap.entries()) {
    const totalContracts = [...vendorMap.values()].reduce((a, b) => a + b, 0);
    totalAgenciesWithVendors++;
    const sorted = [...vendorMap.entries()].sort((a, b) => b[1] - a[1]);
    const [topVendor, topWins] = sorted[0];
    const share = topWins / totalContracts;
    if (vendorMap.size === 1) singleVendorAgencies++;
    concentrationStats.push({
      agency,
      totalContracts,
      uniqueVendors: vendorMap.size,
      topVendor,
      topVendorWins: topWins,
      topVendorShare: round2(share * 100),
    });
  }

  const highConcentration = concentrationStats
    .filter(c => c.totalContracts >= 5)
    .sort((a, b) => b.topVendorShare - a.topVendorShare)
    .slice(0, 10);

  console.log(`\nAgencies with vendor data: ${totalAgenciesWithVendors}`);
  console.log(`Single-vendor agencies (100% concentration): ${singleVendorAgencies} (${round2(singleVendorAgencies / totalAgenciesWithVendors * 100)}%)`);
  console.log('\nHighest concentration agencies (≥5 contracts):');
  highConcentration.forEach(c => {
    console.log(`  ${c.agency.slice(0, 40).padEnd(40)} ${c.topVendorShare}% (${c.topVendorWins}/${c.totalContracts}) — ${c.topVendor.slice(0, 30)}`);
  });

  // ── FINDING 3: Vendor win-rate across agencies ────────────────────────────────
  console.log('\n=== FINDING 3: Top vendors by contract count and cross-agency reach ===');

  const vendorAgencyMap = new Map<string, Set<string>>();
  const vendorWins      = new Map<string, number>();
  const vendorDiscounts = new Map<string, number[]>();

  for (const c of valid) {
    if (!c.winnerName) continue;
    const v = c.winnerName;
    vendorWins.set(v, (vendorWins.get(v) ?? 0) + 1);
    if (!vendorAgencyMap.has(v)) vendorAgencyMap.set(v, new Set());
    vendorAgencyMap.get(v)!.add(c.agency);
    if (!vendorDiscounts.has(v)) vendorDiscounts.set(v, []);
    vendorDiscounts.get(v)!.push(c.discountFromReference!);
  }

  const topVendors = [...vendorWins.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, wins]) => ({
      name,
      wins,
      agencyCount: vendorAgencyMap.get(name)!.size,
      medianDiscount: round2(median(vendorDiscounts.get(name) ?? [])),
      stddevDiscount: round2(stddev(vendorDiscounts.get(name) ?? [])),
    }));

  console.log('\nTop 20 vendors by wins:');
  topVendors.forEach(v => {
    console.log(`  ${v.name.slice(0, 45).padEnd(45)} wins=${v.wins} agencies=${v.agencyCount} medianDisc=${v.medianDiscount}% sdDisc=${v.stddevDiscount}%`);
  });

  // Vendors that appear across most agencies (cross-agency dominance)
  const crossAgencyVendors = [...vendorAgencyMap.entries()]
    .filter(([, agencies]) => agencies.size >= 5)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10)
    .map(([name, agencies]) => ({
      name,
      agencyCount: agencies.size,
      wins: vendorWins.get(name) ?? 0,
    }));

  console.log('\nVendors appearing in most agencies (≥5):');
  crossAgencyVendors.forEach(v => {
    console.log(`  ${v.name.slice(0, 45).padEnd(45)} agencies=${v.agencyCount} wins=${v.wins}`);
  });

  // ── FINDING 4: Z-score anomaly detection ────────────────────────────────────
  console.log('\n=== FINDING 4: Z-score anomalies ===');

  // Per-agency Z-scores
  type AnomalyContract = AwardedContract & { zScore: number; agencyMedian: number; agencyStddev: number };
  const anomalies: AnomalyContract[] = [];

  for (const [agency, discounts] of agencyMap.entries()) {
    if (discounts.length < 5) continue;
    const m  = mean(discounts);
    const sd = stddev(discounts);
    if (sd === 0) continue;

    const agencyContracts = valid.filter(c => c.agency === agency);
    for (const c of agencyContracts) {
      const z = (c.discountFromReference! - m) / sd;
      if (Math.abs(z) >= 2.0) {
        anomalies.push({ ...c, zScore: round2(z), agencyMedian: round2(median(discounts)), agencyStddev: round2(sd) });
      }
    }
  }

  const topAnomalies = anomalies.sort((a, b) => b.zScore - a.zScore).slice(0, 20);

  console.log(`\nTotal anomalous contracts (|Z| ≥ 2.0): ${anomalies.length}`);
  console.log(`Positive Z-score anomalies (discount way above agency norm): ${anomalies.filter(a => a.zScore > 0).length}`);
  console.log(`Negative Z-score anomalies (discount way below agency norm): ${anomalies.filter(a => a.zScore < 0).length}`);
  console.log('\nTop 20 highest positive Z-score contracts:');
  topAnomalies.slice(0, 20).forEach(a => {
    console.log(`  Z=${a.zScore} disc=${a.discountFromReference}% (agency median=${a.agencyMedian}%) | ${a.agency.slice(0,35)} | ${a.projectName?.slice(0,40) ?? ''}`);
  });

  const extremeDiscount = valid.filter(c => c.discountFromReference! >= 50).sort((a, b) => b.discountFromReference! - a.discountFromReference!).slice(0, 10);
  console.log('\nContracts with discount ≥ 50%:');
  extremeDiscount.forEach(c => {
    console.log(`  disc=${c.discountFromReference}% | refPrice=${c.referencePrice?.toLocaleString()} | ${c.agency.slice(0,35)} | ${c.projectType}`);
  });

  // ── FINDING 5: Near-zero discount contracts (lock-in signals) ────────────────
  console.log('\n=== FINDING 5: Near-zero discount contracts ===');

  const nearZero = valid.filter(c => c.discountFromReference! < 0.5);
  const nearZeroCompetitive = competitive.filter(c => c.discountFromReference! < 0.5);

  console.log(`\nAll methods, discount < 0.5%: ${nearZero.length} (${round2(nearZero.length / valid.length * 100)}% of valid)`);
  console.log(`Competitive only, discount < 0.5%: ${nearZeroCompetitive.length} (${round2(nearZeroCompetitive.length / competitive.length * 100)}% of competitive)`);

  // Which agencies have the most near-zero competitive contracts?
  const nearZeroByAgency = new Map<string, number>();
  for (const c of nearZeroCompetitive) {
    nearZeroByAgency.set(c.agency, (nearZeroByAgency.get(c.agency) ?? 0) + 1);
  }
  const topNearZeroAgencies = [...nearZeroByAgency.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('\nAgencies with most competitive near-zero discount contracts:');
  topNearZeroAgencies.forEach(([agency, count]) => {
    const total = agencyMap.get(agency)?.length ?? 0;
    console.log(`  ${agency.slice(0,45).padEnd(45)} ${count}/${total} contracts`);
  });

  // ── FINDING 6: Project type analysis ────────────────────────────────────────
  console.log('\n=== FINDING 6: Project type patterns ===');

  const typeMap = new Map<string, number[]>();
  for (const c of valid) {
    if (!c.projectType) continue;
    if (!typeMap.has(c.projectType)) typeMap.set(c.projectType, []);
    typeMap.get(c.projectType)!.push(c.discountFromReference!);
  }

  const typeStats = [...typeMap.entries()]
    .filter(([, d]) => d.length >= 20)
    .map(([type, discounts]) => ({
      type,
      n: discounts.length,
      medianDiscount: round2(median(discounts)),
      stddev: round2(stddev(discounts)),
    }))
    .sort((a, b) => b.n - a.n);

  console.log('\nProject type discount profiles (≥20 contracts):');
  typeStats.slice(0, 15).forEach(t => {
    console.log(`  ${t.type.slice(0,45).padEnd(45)} n=${String(t.n).padStart(5)} median=${t.medianDiscount}% stddev=${t.stddev}%`);
  });

  // ── FINDING 7: Fiscal year trends ────────────────────────────────────────────
  console.log('\n=== FINDING 7: Fiscal year trends ===');

  const yearMap = new Map<number, number[]>();
  for (const c of valid) {
    if (!c.fiscalYear) continue;
    if (!yearMap.has(c.fiscalYear)) yearMap.set(c.fiscalYear, []);
    yearMap.get(c.fiscalYear)!.push(c.discountFromReference!);
  }

  const yearStats = [...yearMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, discounts]) => ({
      year,
      n: discounts.length,
      medianDiscount: round2(median(discounts)),
      p25: round2(percentile(discounts, 25)),
      p75: round2(percentile(discounts, 75)),
    }));

  console.log('\nDiscount trends by fiscal year:');
  yearStats.forEach(y => {
    console.log(`  FY${y.year}: n=${String(y.n).padStart(5)} median=${y.medianDiscount}% [${y.p25}–${y.p75}]`);
  });

  // ── FINDING 8: Provincial patterns ───────────────────────────────────────────
  console.log('\n=== FINDING 8: Provincial patterns ===');

  const provinceMap = new Map<string, number[]>();
  const provinceVendors = new Map<string, Set<string>>();
  for (const c of valid) {
    if (!c.province) continue;
    if (!provinceMap.has(c.province)) provinceMap.set(c.province, []);
    provinceMap.get(c.province)!.push(c.discountFromReference!);
    if (c.winnerName) {
      if (!provinceVendors.has(c.province)) provinceVendors.set(c.province, new Set());
      provinceVendors.get(c.province)!.add(c.winnerName);
    }
  }

  const provinceStats = [...provinceMap.entries()]
    .filter(([, d]) => d.length >= 20)
    .map(([province, discounts]) => ({
      province,
      n: discounts.length,
      medianDiscount: round2(median(discounts)),
      uniqueVendors: provinceVendors.get(province)?.size ?? 0,
      vendorDensity: round2((provinceVendors.get(province)?.size ?? 0) / discounts.length),
    }))
    .sort((a, b) => a.medianDiscount - b.medianDiscount);

  console.log('\nProvinces by median discount (≥20 contracts):');
  console.log('  Lowest competition (lowest discount):');
  provinceStats.slice(0, 10).forEach(p => {
    console.log(`  ${p.province.padEnd(25)} n=${p.n} median=${p.medianDiscount}% vendors=${p.uniqueVendors}`);
  });
  console.log('  Highest competition (highest discount):');
  [...provinceStats].reverse().slice(0, 10).forEach(p => {
    console.log(`  ${p.province.padEnd(25)} n=${p.n} median=${p.medianDiscount}% vendors=${p.uniqueVendors}`);
  });

  // ── FINDING 9: Budget size vs discount correlation ───────────────────────────
  console.log('\n=== FINDING 9: Budget tier vs discount ===');

  const TIERS = [
    { label: '<100k',    min: 0,          max: 100_000 },
    { label: '100k–1M',  min: 100_000,    max: 1_000_000 },
    { label: '1M–10M',   min: 1_000_000,  max: 10_000_000 },
    { label: '10M–100M', min: 10_000_000, max: 100_000_000 },
    { label: '>100M',    min: 100_000_000, max: Infinity },
  ];

  for (const tier of TIERS) {
    const tierContracts = valid.filter(c => c.referencePrice! >= tier.min && c.referencePrice! < tier.max);
    const tierDiscounts = tierContracts.map(c => c.discountFromReference!);
    if (tierDiscounts.length === 0) continue;
    console.log(`  ${tier.label.padEnd(12)} n=${String(tierContracts.length).padStart(5)} median=${round2(median(tierDiscounts))}% mean=${round2(mean(tierDiscounts))}%`);
  }

  // ── FINDING 10: Vendor discount consistency (bid-rigging signal) ──────────────
  console.log('\n=== FINDING 10: Suspiciously consistent vendor discounts ===');

  // Vendors with many wins at nearly identical discount rates (very low stddev)
  const consistentVendors = [...vendorDiscounts.entries()]
    .filter(([, d]) => d.length >= 5)
    .map(([name, discounts]) => ({
      name,
      wins: discounts.length,
      medianDiscount: round2(median(discounts)),
      stddevDiscount: round2(stddev(discounts)),
      agencyCount: vendorAgencyMap.get(name)?.size ?? 0,
    }))
    .filter(v => v.stddevDiscount < 1.0) // incredibly consistent
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 15);

  console.log('\nVendors with ≥5 wins and discount stddev < 1% (suspiciously consistent):');
  if (consistentVendors.length === 0) {
    console.log('  None found — trying stddev < 2%...');
    const v2 = [...vendorDiscounts.entries()]
      .filter(([, d]) => d.length >= 5)
      .map(([name, discounts]) => ({
        name, wins: discounts.length,
        medianDiscount: round2(median(discounts)),
        stddevDiscount: round2(stddev(discounts)),
        agencyCount: vendorAgencyMap.get(name)?.size ?? 0,
      }))
      .filter(v => v.stddevDiscount < 2.0)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 15);
    v2.forEach(v => {
      console.log(`  ${v.name.slice(0,45).padEnd(45)} wins=${v.wins} agencies=${v.agencyCount} median=${v.medianDiscount}% sd=${v.stddevDiscount}%`);
    });
  } else {
    consistentVendors.forEach(v => {
      console.log(`  ${v.name.slice(0,45).padEnd(45)} wins=${v.wins} agencies=${v.agencyCount} median=${v.medianDiscount}% sd=${v.stddevDiscount}%`);
    });
  }

  // ── FINDING 11: Procurement method distribution ───────────────────────────────
  console.log('\n=== FINDING 11: Procurement method breakdown ===');

  const methodMap = new Map<string, number[]>();
  for (const c of valid) {
    const m = c.procurementMethod ?? 'unknown';
    if (!methodMap.has(m)) methodMap.set(m, []);
    methodMap.get(m)!.push(c.discountFromReference!);
  }

  [...methodMap.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10)
    .forEach(([method, discounts]) => {
      console.log(`  ${method.slice(0,50).padEnd(50)} n=${String(discounts.length).padStart(5)} median=${round2(median(discounts))}%`);
    });

  // ── FINDING 12: Agencies switching from competitive to near-zero over time ─────
  console.log('\n=== FINDING 12: Agencies that shifted from competitive to near-zero discounts ===');

  // For agencies with data in multiple fiscal years, track median discount over time
  type YearAgencyKey = `${string}::${number}`;
  const agencyYearMap = new Map<YearAgencyKey, number[]>();
  for (const c of valid) {
    if (!c.fiscalYear) continue;
    const key: YearAgencyKey = `${c.agency}::${c.fiscalYear}`;
    if (!agencyYearMap.has(key)) agencyYearMap.set(key, []);
    agencyYearMap.get(key)!.push(c.discountFromReference!);
  }

  // Find agencies that appear in at least 3 fiscal years
  const agencyYears = new Map<string, Map<number, number>>();
  for (const [key, discounts] of agencyYearMap.entries()) {
    const [agency, yearStr] = key.split('::');
    const year = parseInt(yearStr);
    if (!agencyYears.has(agency)) agencyYears.set(agency, new Map());
    agencyYears.get(agency)!.set(year, round2(median(discounts)));
  }

  const agenciesWithTrend = [...agencyYears.entries()]
    .filter(([, ymap]) => ymap.size >= 3)
    .map(([agency, ymap]) => {
      const years = [...ymap.entries()].sort((a, b) => a[0] - b[0]);
      const first = years[0][1];
      const last  = years[years.length - 1][1];
      return { agency, years, trend: round2(last - first), first, last };
    });

  const bigDropAgencies = agenciesWithTrend
    .filter(a => a.trend < -10) // dropped 10pp or more
    .sort((a, b) => a.trend - b.trend)
    .slice(0, 10);

  const bigRiseAgencies = agenciesWithTrend
    .filter(a => a.trend > 10)
    .sort((a, b) => b.trend - a.trend)
    .slice(0, 10);

  console.log('\nAgencies where competition dropped most (discount fell ≥10pp over time):');
  bigDropAgencies.forEach(a => {
    const yearStr = a.years.map(([y, m]) => `FY${y}:${m}%`).join(' → ');
    console.log(`  ${a.agency.slice(0,40).padEnd(40)} ${yearStr}`);
  });
  console.log('\nAgencies where competition increased most (discount rose ≥10pp):');
  bigRiseAgencies.forEach(a => {
    const yearStr = a.years.map(([y, m]) => `FY${y}:${m}%`).join(' → ');
    console.log(`  ${a.agency.slice(0,40).padEnd(40)} ${yearStr}`);
  });

  // ── Save full findings JSON ──────────────────────────────────────────────────
  console.log('\n=== Saving findings to file ===');

  const findings = {
    meta: {
      totalLoaded: all.length,
      validDiscountContracts: valid.length,
      competitiveContracts: competitive.length,
      generatedAt: new Date().toISOString(),
    },
    agencyDiscountProfiles: {
      totalAgenciesAnalyzed: agencyStats.length,
      lowestMedian5: lowestMedian,
      highestMedian5: highestMedian,
      highestVariance5: highVarianceAgencies,
      lowestVariance5: lowVarianceAgencies,
    },
    vendorConcentration: {
      totalAgenciesWithVendorData: totalAgenciesWithVendors,
      singleVendorCount: singleVendorAgencies,
      singleVendorPct: round2(singleVendorAgencies / totalAgenciesWithVendors * 100),
      top10HighConcentration: highConcentration,
    },
    topVendors,
    crossAgencyVendors,
    anomalies: {
      total: anomalies.length,
      positiveZ: anomalies.filter(a => a.zScore > 0).length,
      negativeZ: anomalies.filter(a => a.zScore < 0).length,
      top20: topAnomalies.map(a => ({
        agency: a.agency,
        projectName: a.projectName,
        projectType: a.projectType,
        discount: a.discountFromReference,
        referencePrice: a.referencePrice,
        zScore: a.zScore,
        agencyMedian: a.agencyMedian,
        agencyStddev: a.agencyStddev,
        fiscalYear: a.fiscalYear,
        province: a.province,
        winnerName: a.winnerName,
        procurementMethod: a.procurementMethod,
      })),
      extremeDiscount: extremeDiscount.map(c => ({
        agency: c.agency,
        projectName: c.projectName,
        discount: c.discountFromReference,
        referencePrice: c.referencePrice,
        agreedPrice: c.agreedPrice,
        fiscalYear: c.fiscalYear,
        winnerName: c.winnerName,
      })),
    },
    nearZeroCompetitive: {
      total: nearZeroCompetitive.length,
      pctOfCompetitive: round2(nearZeroCompetitive.length / competitive.length * 100),
      topAgencies: topNearZeroAgencies.map(([agency, count]) => ({
        agency, count,
        totalContracts: agencyMap.get(agency)?.length ?? 0,
      })),
    },
    projectTypeStats: typeStats,
    fiscalYearTrends: yearStats,
    provincialStats: {
      lowest10: provinceStats.slice(0, 10),
      highest10: [...provinceStats].reverse().slice(0, 10),
    },
    budgetTierStats: TIERS.map(tier => {
      const tierContracts = valid.filter(c => c.referencePrice! >= tier.min && c.referencePrice! < tier.max);
      const d = tierContracts.map(c => c.discountFromReference!);
      return { label: tier.label, n: tierContracts.length, medianDiscount: d.length ? round2(median(d)) : 0, meanDiscount: d.length ? round2(mean(d)) : 0 };
    }),
    consistentVendors,
    methodBreakdown: [...methodMap.entries()].sort((a,b) => b[1].length - a[1].length).slice(0, 10).map(([method, d]) => ({
      method, n: d.length, medianDiscount: round2(median(d)),
    })),
    agencyTrends: {
      bigDropAgencies: bigDropAgencies.map(a => ({ agency: a.agency, trend: a.trend, first: a.first, last: a.last, years: a.years })),
      bigRiseAgencies: bigRiseAgencies.map(a => ({ agency: a.agency, trend: a.trend, first: a.first, last: a.last, years: a.years })),
    },
  };

  const outPath = path.join(process.cwd(), 'scripts', 'test-results', 'findings.json');
  fs.writeFileSync(outPath, JSON.stringify(findings, null, 2));
  console.log(`\n✅ Full findings saved to ${outPath}`);
  console.log('\n=== SUMMARY ===');
  console.log(`Total contracts analyzed: ${all.length}`);
  console.log(`Valid (have discount): ${valid.length}`);
  console.log(`Competitive method: ${competitive.length}`);
  console.log(`Agencies analyzed: ${agencyStats.length}`);
  console.log(`Single-vendor agencies: ${singleVendorAgencies}/${totalAgenciesWithVendors} (${round2(singleVendorAgencies/totalAgenciesWithVendors*100)}%)`);
  console.log(`Anomalous contracts (|Z|≥2): ${anomalies.length}`);
  console.log(`Near-zero competitive contracts (<0.5%): ${nearZeroCompetitive.length}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
