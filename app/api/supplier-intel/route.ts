import { NextRequest, NextResponse } from 'next/server';
import { getAwardedContracts } from '@/lib/data-service';

export const dynamic = 'force-dynamic';

// Keywords matched against projectName (the detailed description), not projectType
// CGD projectType is high-level (ซื้อ/จ้าง/ก่อสร้าง); category lives in projectName.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  construction: ['ก่อสร้าง'],
  renovation:   ['ปรับปรุง', 'ซ่อมแซม', 'ซ่อมบำรุง'],
  medical:      ['การแพทย์', 'เวชภัณฑ์', 'โรงพยาบาล', 'สาธารณสุข', 'ยา', 'เภสัช'],
  technology:   ['เทคโนโลยี', 'สารสนเทศ', 'คอมพิวเตอร์', 'ซอฟต์แวร์', 'ดิจิทัล'],
  food:         ['อาหาร', 'โภชนาการ'],
  education:    ['การศึกษา', 'หนังสือ', 'ห้องสมุด', 'เครื่องเขียน'],
  security:     ['รักษาความปลอดภัย', 'กล้องวงจรปิด', 'CCTV'],
  consulting:   ['ที่ปรึกษา', 'ออกแบบ', 'ควบคุมงาน'],
  logistics:    ['ขนส่ง', 'ยานพาหนะ', 'รถยนต์', 'รถบรรทุก', 'น้ำมันเชื้อเพลิง'],
  agriculture:  ['เกษตร', 'ประมง', 'ปศุสัตว์', 'สิ่งแวดล้อม', 'บำบัดน้ำ'],
  cleaning:     ['ทำความสะอาด', 'กำจัดขยะ', 'เก็บขยะ'],
  other:        [],
};

export interface SupplierCategoryStats {
  category: string;
  totalContracts: number;
  totalBudget: number;
  avgBudget: number;
  topContractors: {
    name: string;
    wins: number;
    totalValue: number;
    avgValue: number;
    businessId: string | null;
  }[];
  recentTenders: {
    projectId: string;
    projectName: string;
    agency: string;
    budget: number | null;
    agreedPrice: number | null;
    announceDate: string;
    winnerName: string | null;
  }[];
  growthTrend: { year: number; count: number; totalBudget: number }[];
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category')?.trim();
  if (!category) return NextResponse.json({ error: 'category param required' }, { status: 400 });

  const all = await getAwardedContracts();

  // Resolve keywords: if category is a known English key use its Thai keywords;
  // otherwise treat the value itself as a Thai keyword (direct search).
  const keywords = CATEGORY_KEYWORDS[category] ?? [category];
  const contracts = category === 'other'
    ? all.filter((c) => {
        const name = (c.projectName ?? '').toLowerCase();
        return !Object.values(CATEGORY_KEYWORDS).flat().some((kw) => name.includes(kw));
      })
    : all.filter((c) => {
        const name = c.projectName ?? '';
        return keywords.some((kw) => name.includes(kw));
      });

  if (contracts.length === 0) {
    return NextResponse.json({ error: 'No data for this category' }, { status: 404 });
  }

  const totalBudget = contracts.reduce((s, c) => s + (c.budget ?? 0), 0);
  const avgBudget = contracts.length > 0 ? totalBudget / contracts.length : 0;

  // "31 มี.ค. 71" style date-in-name — data quality artifact in CGD source where
  // the date column was misread as the company name for some records.
  // U+0E00–U+0E7F covers the full Thai Unicode block (consonants + vowels + tone marks).
  const datePattern = /^\d{1,2}\s[฀-๿.]+\s\d{2}$/;

  // Top contractors
  const contractorMap = new Map<string, { wins: number; totalValue: number; businessId: string | null }>();
  for (const c of contracts) {
    if (!c.winnerName || datePattern.test(c.winnerName.trim())) continue;
    const e = contractorMap.get(c.winnerName) ?? { wins: 0, totalValue: 0, businessId: c.winnerBusinessId };
    e.wins++;
    e.totalValue += c.agreedPrice ?? 0;
    contractorMap.set(c.winnerName, e);
  }
  const topContractors = [...contractorMap.entries()]
    .sort((a, b) => b[1].totalValue - a[1].totalValue)
    .slice(0, 20)
    .map(([name, { wins, totalValue, businessId }]) => ({
      name,
      wins,
      totalValue,
      avgValue: wins > 0 ? totalValue / wins : 0,
      businessId,
    }));

  // Recent contracts
  const recentTenders = [...contracts]
    .sort((a, b) => (b.announceDate ?? '').localeCompare(a.announceDate ?? ''))
    .slice(0, 30)
    .map((c) => ({
      projectId: c.projectId,
      projectName: c.projectName,
      agency: c.agency,
      budget: c.budget,
      agreedPrice: c.agreedPrice,
      announceDate: c.announceDate,
      winnerName: c.winnerName,
    }));

  // Growth trend by fiscal year
  const fyMap = new Map<number, { count: number; totalBudget: number }>();
  for (const c of contracts) {
    const e = fyMap.get(c.fiscalYear) ?? { count: 0, totalBudget: 0 };
    e.count++;
    e.totalBudget += c.budget ?? 0;
    fyMap.set(c.fiscalYear, e);
  }
  const growthTrend = [...fyMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, { count, totalBudget }]) => ({ year, count, totalBudget }));

  const stats: SupplierCategoryStats = {
    category,
    totalContracts: contracts.length,
    totalBudget,
    avgBudget,
    topContractors,
    recentTenders,
    growthTrend,
  };

  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=600' },
  });
}
