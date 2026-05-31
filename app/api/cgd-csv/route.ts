import { NextResponse } from 'next/server';
import { getAwardedContracts } from '@/lib/data-service';

export async function GET() {
  const contracts = await getAwardedContracts();

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

  return new NextResponse(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
