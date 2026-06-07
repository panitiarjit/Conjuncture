import { NextRequest, NextResponse } from 'next/server';
import { getAwardedContractsPage } from '@/lib/data-service';

const CF_CACHE_TTL = 12 * 60 * 60; // 12 hours in seconds

export async function GET(req: NextRequest) {
  // Serve from Cloudflare edge cache if available (free, built into every Worker)
  const cfCache = typeof caches !== 'undefined' ? caches.default : null;
  if (cfCache) {
    try {
      const cached = await cfCache.match(req.url);
      if (cached) return cached;
    } catch { /* cache unavailable, fall through to Firestore */ }
  }

  const pageToken = req.nextUrl.searchParams.get('pageToken') ?? undefined;
  let contracts, nextPageToken;
  try {
    // 500 records = 1 Firestore REST call, stays within Cloudflare CPU limits
    ({ contracts, nextPageToken } = await getAwardedContractsPage(500, pageToken));
  } catch (err) {
    return new NextResponse(`Firestore error: ${(err as Error).message}`, { status: 503 });
  }

  const headers = [
    'ชื่อโครงการ', 'หน่วยงาน', 'หน่วยงานย่อย',
    'จังหวัด', 'จังหวัด (Eng)', 'เขต/อำเภอ', 'เขต/อำเภอ (Eng)', 'แขวง/ตำบล', 'แขวง/ตำบล (Eng)',
    'พิกัด (WKT)', 'ละติจูด', 'ลองจิจูด',
    'ประเภท', 'วิธีจัดซื้อ (กลุ่ม)', 'วิธีจัดซื้อ (รายละเอียด)',
    'วันที่ประกาศ', 'วันที่เกิดรายการ',
    'งบประมาณ (บาท)', 'ราคากลาง (บาท)', 'ราคาตกลง (บาท)', 'ส่วนลด (%)',
    'ผู้ชนะ', 'เลขนิติบุคคล',
    'จำนวนผู้เสนอราคา', 'ผู้แพ้ (CoST)',
    'เลขที่สัญญา', 'วันที่ลงนามสัญญา', 'วันที่สิ้นสุดสัญญา',
    'งบสัญญา (บาท)', 'สถานะสัญญา', 'สถานะโครงการ',
    'รหัสโครงการ', 'ปีงบประมาณ',
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
  // Only filter non-null strings that match a Thai date pattern
  const isJunkRow = (c: typeof contracts[0]) =>
    (!!c.winnerName && THAI_DATE_RE.test(c.winnerName)) ||
    (!!c.winnerBusinessId && THAI_DATE_RE.test(String(c.winnerBusinessId)));

  const lines = [headers.map(esc).join(',')];
  for (const c of contracts) {
    if (isJunkRow(c)) continue; // skip bad-data rows
    lines.push([
      c.projectName, c.agency, c.subAgency ?? '',
      c.province ?? '', c.provinceEn ?? '', c.district ?? '', c.districtEn ?? '', c.subDistrict ?? '', c.subDistrictEn ?? '',
      c.gpsPoint ?? '', c.latitude ?? '', c.longitude ?? '',
      c.projectType ?? '', c.procurementMethodGroup ?? '', c.procurementMethod ?? '',
      c.announceDate ?? '', c.transactionDate ?? '',
      c.budget ?? '', c.referencePrice ?? '', c.agreedPrice ?? '', c.discountFromReference ?? '',
      c.winnerName ?? '', c.winnerBusinessId ?? '',
      c.bidders?.length ?? (c.losers?.length ? c.losers.length + 1 : ''),
      (c.losers ?? []).join('; '),
      c.contractNo ?? '', c.contractSignDate ?? '', c.contractEndDate ?? '',
      c.contractValue ?? '', c.contractStatus ?? '', c.projectStatus ?? '',
      c.projectId, c.fiscalYear ?? '',
    ].map(esc).join(','));
  }

  // Embed the next-page token as the final CSV row so it survives Cloudflare
  // header lowercasing. The Apps Script reads and strips this sentinel line.
  if (nextPageToken) lines.push(`##NEXT_PAGE_TOKEN,${nextPageToken}`);

  const response = new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': `public, max-age=${CF_CACHE_TTL}, s-maxage=${CF_CACHE_TTL}`,
      'Access-Control-Allow-Origin': '*',
    },
  });

  // Store in Cloudflare edge cache so repeated imports don't re-read Firestore
  if (cfCache) {
    try {
      await cfCache.put(req.url, response.clone());
    } catch { /* non-critical, continue without caching */ }
  }

  return response;
}
