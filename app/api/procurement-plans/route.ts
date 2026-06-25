import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CKAN_BASE = 'https://data.go.th/api/3/action/datastore_search';

// Known CKAN resource IDs for procurement plans (แผนการจัดซื้อจัดจ้าง)
// Resource 64c6cacb: annual plan with รหัสแผนงาน, ชื่อโครงการ, งบประมาณ, เดือน, ปี
const PLAN_RESOURCE_ID = '64c6cacb-aca1-4b10-b87e-e7e9114e999f';

export interface ProcurementPlan {
  planCode: string;
  projectName: string;
  budget: number;
  month: number;
  year: number;         // CE year
  plannedDate: string;  // ISO approximate date
}

export interface PlansResponse {
  plans: ProcurementPlan[];
  total: number;
  source: string;
}

function beToCe(beYear: number): number {
  return beYear > 2000 ? beYear - 543 : beYear;
}

export async function GET(req: NextRequest) {
  const page = parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10);
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    const res = await fetch(
      `${CKAN_BASE}?resource_id=${PLAN_RESOURCE_ID}&limit=${limit}&offset=${offset}&sort=ปี%20desc%2Cเดือน%20desc`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) throw new Error(`CKAN ${res.status}`);

    const data = (await res.json()) as {
      result?: {
        total: number;
        records: { _id: number; รหัสแผนงาน: string; ชื่อโครงการ: string; งบประมาณ: number; เดือน: number; ปี: number }[];
      };
    };

    const records = data.result?.records ?? [];
    const total = data.result?.total ?? 0;

    const plans: ProcurementPlan[] = records.map((r) => {
      const ceYear = beToCe(r.ปี);
      return {
        planCode: r.รหัสแผนงาน ?? '',
        projectName: r.ชื่อโครงการ ?? '',
        budget: r.งบประมาณ ?? 0,
        month: r.เดือน,
        year: ceYear,
        plannedDate: `${ceYear}-${String(r.เดือน).padStart(2, '0')}-01`,
      };
    });

    const response: PlansResponse = { plans, total, source: 'data.go.th CKAN' };
    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch procurement plans: ${(err as Error).message}` },
      { status: 502 },
    );
  }
}
