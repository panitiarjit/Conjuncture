import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
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

  // When losersOnly, keep only CoST projects that have identified losers
  const rows = losersOnly
    ? contracts.filter((c) => (c.losers?.length ?? 0) > 0)
    : contracts;

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No data found' }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Conjuncture';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Prospects', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  // Header style
  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E3A5F' },
  };
  const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

  const columns: { header: string; key: string; width: number }[] = [
    { header: 'ชื่อโครงการ', key: 'projectName', width: 50 },
    { header: 'หน่วยงาน', key: 'agency', width: 30 },
    { header: 'จังหวัด', key: 'province', width: 14 },
    { header: 'ประเภท', key: 'projectType', width: 22 },
    { header: 'วิธีจัดซื้อ', key: 'procurementMethodGroup', width: 28 },
    { header: 'งบประมาณ (บาท)', key: 'budget', width: 18 },
    { header: 'ราคากลาง (บาท)', key: 'referencePrice', width: 18 },
    { header: 'ราคาตกลง (บาท)', key: 'agreedPrice', width: 18 },
    { header: 'ส่วนลด (%)', key: 'discountFromReference', width: 12 },
    { header: 'ผู้ชนะ', key: 'winnerName', width: 35 },
    { header: 'เลขนิติบุคคล', key: 'winnerBusinessId', width: 18 },
    { header: 'ผู้แพ้ (CoST)', key: 'losers', width: 40 },
    { header: 'รหัสโครงการ', key: 'projectId', width: 16 },
    { header: 'ปีงบประมาณ', key: 'fiscalYear', width: 12 },
    { header: 'DBD Lookup', key: 'dbdUrl', width: 40 },
    { header: 'ข้อความติดต่อ', key: 'outreach', width: 70 },
    { header: 'ติดต่อแล้ว', key: 'contacted', width: 12 },
    { header: 'ตอบกลับ', key: 'replied', width: 12 },
    { header: 'หมายเหตุ', key: 'notes', width: 30 },
  ];

  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'FF3B6EA5' } },
    };
  });
  headerRow.height = 28;

  // Data rows
  for (const c of rows) {
    const loserList = c.losers?.join('\n') ?? '';
    const dbdUrl = c.winnerBusinessId ? DBD_URL(c.winnerBusinessId) : '';

    const row = sheet.addRow({
      projectName: c.projectName,
      agency: c.agency,
      province: c.province,
      projectType: c.projectType,
      procurementMethodGroup: c.procurementMethodGroup,
      budget: c.budget,
      referencePrice: c.referencePrice,
      agreedPrice: c.agreedPrice,
      discountFromReference: c.discountFromReference,
      winnerName: c.winnerName ?? '',
      winnerBusinessId: c.winnerBusinessId ?? '',
      losers: loserList,
      projectId: c.projectId,
      fiscalYear: c.fiscalYear,
      dbdUrl,
      outreach: buildOutreachMessage(c),
      contacted: '',
      replied: '',
      notes: '',
    });

    // Number format for money columns
    ['budget', 'referencePrice', 'agreedPrice'].forEach((key) => {
      const cell = row.getCell(key);
      if (cell.value) cell.numFmt = '#,##0.00';
    });
    const discCell = row.getCell('discountFromReference');
    if (discCell.value) discCell.numFmt = '0.00"%"';

    // Hyperlink for DBD
    if (dbdUrl) {
      const dbdCell = row.getCell('dbdUrl');
      dbdCell.value = { text: 'ค้นหาผู้ชนะ', hyperlink: dbdUrl };
      dbdCell.font = { color: { argb: 'FF0563C1' }, underline: true };
    }

    // Wrap text for long fields
    ['projectName', 'outreach', 'losers'].forEach((key) => {
      row.getCell(key).alignment = { wrapText: true, vertical: 'top' };
    });

    row.height = 60;
  }

  // Auto-filter
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();

  const filename = `prospects-${keyword}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
