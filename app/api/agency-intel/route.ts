import { NextRequest, NextResponse } from 'next/server';
import { getAwardedContracts } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

export interface AgencyStats {
  agency: string;
  totalContracts: number;
  totalBudget: number;
  avgDiscount: number | null;
  avgBudget: number | null;
  topCategories: { category: string; count: number }[];
  topWinners: { name: string; count: number; totalValue: number }[];
  recentContracts: {
    projectId: string;
    projectName: string;
    budget: number | null;
    agreedPrice: number | null;
    discountFromReference: number | null;
    winnerName: string | null;
    announceDate: string;
    fiscalYear: number;
  }[];
  fiscalYearBreakdown: { year: number; count: number; totalBudget: number }[];
}

export async function GET(req: NextRequest) {
  const agency = req.nextUrl.searchParams.get('agency')?.trim();
  if (!agency) return NextResponse.json({ error: 'agency param required' }, { status: 400 });

  const all = await getAwardedContracts(undefined, 5_000);
  const contracts = all.filter((c) =>
    c.agency.toLowerCase().includes(agency.toLowerCase()),
  );

  if (contracts.length === 0) {
    return NextResponse.json({ error: 'No data found for this agency' }, { status: 404 });
  }

  const totalBudget = contracts.reduce((s, c) => s + (c.budget ?? 0), 0);
  // Only include plausible discount values (CGD data has corrupt outliers far outside ±100%)
  const withDiscount = contracts.filter(
    (c) => c.discountFromReference !== null && c.discountFromReference >= -100 && c.discountFromReference <= 100,
  );
  const avgDiscount =
    withDiscount.length > 0
      ? withDiscount.reduce((s, c) => s + c.discountFromReference!, 0) / withDiscount.length
      : null;
  const avgBudget = contracts.length > 0 ? totalBudget / contracts.length : null;

  // Top categories
  const catMap = new Map<string, number>();
  for (const c of contracts) {
    const cat = c.projectType || 'Other';
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  }
  const topCategories = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, count]) => ({ category, count }));

  // Top winners — skip CGD date artifacts ("31 มี.ค. 71" stored as winnerName)
  // Date format: 1-2 digits, space, non-whitespace (Thai month abbrev), space, 2 digits
  const datePattern = /^\d{1,2}\s\S+\s\d{2}$/;
  const winnerMap = new Map<string, { count: number; totalValue: number }>();
  for (const c of contracts) {
    const name = c.winnerName?.trim();
    if (!name || name === '-' || datePattern.test(name)) continue;
    const e = winnerMap.get(name) ?? { count: 0, totalValue: 0 };
    e.count++;
    e.totalValue += c.agreedPrice ?? 0;
    winnerMap.set(name, e);
  }
  const topWinners = [...winnerMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, { count, totalValue }]) => ({ name, count, totalValue }));

  // Fiscal year breakdown
  const fyMap = new Map<number, { count: number; totalBudget: number }>();
  for (const c of contracts) {
    const e = fyMap.get(c.fiscalYear) ?? { count: 0, totalBudget: 0 };
    e.count++;
    e.totalBudget += c.budget ?? 0;
    fyMap.set(c.fiscalYear, e);
  }
  const fiscalYearBreakdown = [...fyMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, { count, totalBudget }]) => ({ year, count, totalBudget }));

  // Recent contracts (sorted by announce date desc)
  const recentContracts = [...contracts]
    .sort((a, b) => (b.announceDate ?? '').localeCompare(a.announceDate ?? ''))
    .slice(0, 50)
    .map((c) => ({
      projectId: c.projectId,
      projectName: c.projectName,
      budget: c.budget,
      agreedPrice: c.agreedPrice,
      discountFromReference: c.discountFromReference,
      winnerName: c.winnerName,
      announceDate: c.announceDate,
      fiscalYear: c.fiscalYear,
    }));

  const stats: AgencyStats = {
    agency: contracts[0].agency,
    totalContracts: contracts.length,
    totalBudget,
    avgDiscount,
    avgBudget,
    topCategories,
    topWinners,
    recentContracts,
    fiscalYearBreakdown,
  };

  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
