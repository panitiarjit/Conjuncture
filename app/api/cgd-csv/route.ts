import { NextRequest, NextResponse } from 'next/server';
import { getAwardedContractsPage } from '@/lib/data-service';

export async function GET(req: NextRequest) {
  const pageToken = req.nextUrl.searchParams.get('pageToken') ?? undefined;
  // 2000 records ≈ 1.5 MB / ~8 s — within Google Sheets IMPORTDATA limits
  const { contracts, nextPageToken } = await getAwardedContractsPage(2_000, pageToken);

  const headers = [
    'ชื่อโครงการ', 'หน่วยงาน', 'จังหวัด', 'ประเภท', 'วิธีจัดซื้อ',
    'งบประมาณ (บาท)', 'ราคากลาง (บาท)', 'ราคาตกลง (บาท)', 'ส่วนลด (%)',
    'ผู้ชนะ', 'เลขนิติบุคคล', 'ผู้แพ้ (CoST)', 'รหัสโครงการ', 'ปีงบประมาณ',
  ];

  const esc = (v: unknown): string => {
    const s = (v == null ? '' : String(v)).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };

  const lines = [headers.map(esc).join(',')];
  for (const c of contracts) {
    lines.push([
      c.projectName, c.agency, c.province ?? '', c.projectType ?? '', c.procurementMethodGroup ?? '',
      c.budget ?? '', c.referencePrice ?? '', c.agreedPrice ?? '', c.discountFromReference ?? '',
      c.winnerName ?? '', c.winnerBusinessId ?? '', (c.losers ?? []).join('; '),
      c.projectId, c.fiscalYear ?? '',
    ].map(esc).join(','));
  }

  const responseHeaders: Record<string, string> = {
    'Content-Type': 'text/csv; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };
  if (nextPageToken) responseHeaders['X-Next-Page-Token'] = nextPageToken;

  return new NextResponse(lines.join('\n'), { headers: responseHeaders });
}
