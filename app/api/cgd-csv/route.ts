import { NextRequest, NextResponse } from 'next/server';
import { getAwardedContractsPage } from '@/lib/data-service';

export async function GET(req: NextRequest) {
  const pageToken = req.nextUrl.searchParams.get('pageToken') ?? undefined;
  // 500 records = 1 Firestore REST call, stays within Cloudflare CPU limits
  const { contracts, nextPageToken } = await getAwardedContractsPage(500, pageToken);

  const headers = [
    'ชื่อโครงการ', 'หน่วยงาน', 'จังหวัด', 'ประเภท', 'วิธีจัดซื้อ',
    'งบประมาณ (บาท)', 'ราคากลาง (บาท)', 'ราคาตกลง (บาท)', 'ส่วนลด (%)',
    'ผู้ชนะ', 'เลขนิติบุคคล', 'จำนวนผู้เสนอราคา', 'ผู้แพ้ (CoST)', 'รหัสโครงการ', 'ปีงบประมาณ',
  ];

  const esc = (v: unknown): string => {
    const s = (v == null ? '' : String(v)).replace(/"/g, '""');
    // Always quote: comma/newline/quote inside, OR pure-digit strings 6+ chars
    // (business IDs, project IDs) so Sheets treats them as text, not numbers.
    if (s.includes(',') || s.includes('"') || s.includes('\n') || /^\d{6,}$/.test(s)) {
      return `"${s}"`;
    }
    return s;
  };

  // Thai short-date pattern: "30 ก.ย. 64" — agencies sometimes enter these
  // in the winner name field instead of a company name.
  const THAI_DATE_RE = /\d{1,2}\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)/;
  const isJunkWinner = (name: string | null) =>
    !name || THAI_DATE_RE.test(name);

  const lines = [headers.map(esc).join(',')];
  for (const c of contracts) {
    if (isJunkWinner(c.winnerName)) continue; // skip bad-data rows
    lines.push([
      c.projectName, c.agency, c.province ?? '', c.projectType ?? '', c.procurementMethodGroup ?? '',
      c.budget ?? '', c.referencePrice ?? '', c.agreedPrice ?? '', c.discountFromReference ?? '',
      c.winnerName ?? '', c.winnerBusinessId ?? '',
      c.bidders?.length ?? (c.losers?.length ? c.losers.length + 1 : ''),
      (c.losers ?? []).join('; '),
      c.projectId, c.fiscalYear ?? '',
    ].map(esc).join(','));
  }

  // Embed the next-page token as the final CSV row so it survives Cloudflare
  // header lowercasing. The Apps Script reads and strips this sentinel line.
  if (nextPageToken) lines.push(`##NEXT_PAGE_TOKEN,${nextPageToken}`);

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
