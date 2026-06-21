import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAwardedContracts } from '@/lib/data-service';
import type { AwardedContract } from '@/lib/types';

const DBD_URL = (businessId: string) =>
  `https://www.dbd.go.th/main.php?filename=index&search=${encodeURIComponent(businessId)}`;

function buildOutreachMessage(c: AwardedContract): string {
  const budget = c.budget ? `฿${c.budget.toLocaleString('th-TH')}` : 'งบประมาณไม่ระบุ';
  const winner = c.winnerName ?? 'ผู้ชนะที่ไม่ระบุ';
  return (
    `สวัสดีครับ/ค่ะ\n\n` +
    `เราพบว่าบริษัทของท่านได้เข้าร่วมประมูลโครงการ "${c.projectName.slice(0, 80)}" ` +
    `กับ ${c.agency} มูลค่า ${budget}\n\n` +
    `ผู้ชนะการประมูลครั้งนี้คือ ${winner}` +
    (c.agreedPrice ? ` ด้วยราคา ฿${c.agreedPrice.toLocaleString('th-TH')}` : '') +
    `\n\nทาง Conjuncture มีการแจ้งเตือนโครงการใหม่ที่ตรงกับประเภทงานของท่านก่อนใคร ` +
    `สนใจทดลองใช้งานฟรีที่ conjuncture.work ครับ/ค่ะ`
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const keyword = searchParams.get('keyword') ?? 'จ้างเหมา';
  const losersOnly = searchParams.get('losers') === 'true';

  const contracts = await getAwardedContracts(keyword);

  const rows = losersOnly
    ? contracts.filter((c) => (c.losers?.length ?? 0) > 0)
    : contracts;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  const data = rows.map((c) => ({
    'ชื่อโครงการ': c.projectName,
    'หน่วยงาน': c.agency,
    'จังหวัด': c.province ?? '',
    'ประเภท': c.projectType ?? '',
    'วิธีจัดซื้อ': c.procurementMethodGroup ?? '',
    'งบประมาณ (บาท)': c.budget ?? '',
    'ราคากลาง (บาท)': c.referencePrice ?? '',
    'ราคาตกลง (บาท)': c.agreedPrice ?? '',
    'ส่วนลด (%)': c.discountFromReference ?? '',
    'ผู้ชนะ': c.winnerName ?? '',
    'เลขนิติบุคคล': c.winnerBusinessId ?? '',
    'ผู้แพ้ (CoST)': c.losers?.join(', ') ?? '',
    'รหัสโครงการ': c.projectId,
    'ปีงบประมาณ': c.fiscalYear ?? '',
    'DBD Lookup': c.winnerBusinessId ? DBD_URL(c.winnerBusinessId) : '',
    'ข้อความติดต่อ': buildOutreachMessage(c),
    'ติดต่อแล้ว': '',
    'ตอบกลับ': '',
    'หมายเหตุ': '',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  ws['!cols'] = [
    { wch: 50 }, // ชื่อโครงการ
    { wch: 30 }, // หน่วยงาน
    { wch: 14 }, // จังหวัด
    { wch: 22 }, // ประเภท
    { wch: 28 }, // วิธีจัดซื้อ
    { wch: 18 }, // งบประมาณ
    { wch: 18 }, // ราคากลาง
    { wch: 18 }, // ราคาตกลง
    { wch: 12 }, // ส่วนลด
    { wch: 35 }, // ผู้ชนะ
    { wch: 18 }, // เลขนิติบุคคล
    { wch: 40 }, // ผู้แพ้
    { wch: 16 }, // รหัสโครงการ
    { wch: 12 }, // ปีงบประมาณ
    { wch: 40 }, // DBD
    { wch: 70 }, // ข้อความติดต่อ
    { wch: 12 }, // ติดต่อแล้ว
    { wch: 12 }, // ตอบกลับ
    { wch: 30 }, // หมายเหตุ
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Prospects');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = `prospects-${keyword}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
