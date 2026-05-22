import type { Tender, ProjectCategory, TenderStatus } from '../types';
import { ALL_THAI_PROVINCES } from '../data-utils';
import type { RawAnnouncement } from './types';

// ── Category mapping ────────────────────────────────────────────────────────

export function mapCategory(typeId: string | null | undefined, flowName: string | undefined, title: string | undefined): ProjectCategory {
  const combined = `${typeId ?? ''} ${flowName ?? ''} ${title ?? ''}`;

  // Medical / pharmaceutical — check first; hospitals dominate Thai procurement
  if (/ยา(?!สูบ|พิษ)|เวชภัณฑ์|เวชกรรม|การแพทย์|ทันตกรรม|ทันต์|โรงพยาบาล|สาธารณสุข|ครุภัณฑ์การแพทย์|วัสดุการแพทย์|วัสดุสาธารณสุข|เภสัช|น้ำยาล้าง|น้ำเกลือ|เลือด|ถุงมือแพทย์|ชุดตรวจ|อุปกรณ์การแพทย์|รังสี|ผ่าตัด|วัคซีน|สายสวน|เครื่องมือแพทย์|สุขภาพ/.test(combined)) return 'medical';

  // Food & catering
  if (/อาหาร|โภชนาการ|วัสดุอาหาร|อาหารกลางวัน|อาหารสัตว์|เครื่องดื่ม|ผลิตภัณฑ์นม|นม(?!วัย)|น้ำดื่ม(?!ประปา)/.test(combined)) return 'food';

  // Education & training
  if (/วัสดุการศึกษา|ครุภัณฑ์การศึกษา|หนังสือ|ตำรา|โรงเรียน|มหาวิทยาลัย|วิทยาลัย|การศึกษา|ห้องสมุด|เครื่องเขียน|แบบเรียน|กระดาษ(?!ชำระ)|สื่อการเรียน|กีฬา(?!สถาน)/.test(combined)) return 'education';

  // Security services & surveillance
  if (/รักษาความปลอดภัย|กล้องวงจรปิด|CCTV|ระบบเฝ้าระวัง|สัญญาณกันขโมย|ระบบควบคุมการเข้าออก|ป้องกัน(?:ภัย|อัคคีภัย)|ดับเพลิง/.test(combined)) return 'security';

  // Construction — new builds only (not repairs)
  if (/ก่อสร้าง|สร้างอาคาร|สร้างถนน|สร้างสะพาน|ก่อสร้างอาคาร|ก่อสร้างถนน|ก่อสร้างสะพาน/.test(combined)) return 'construction';

  // Renovation / repair (comes after construction to catch "ปรับปรุง+ก่อสร้าง" correctly above)
  if (/ปรับปรุง|ซ่อมแซม|ซ่อมบำรุง|ซ่อม|ต่อเติม|บำรุงรักษา|ทาสี|เปลี่ยน(?:หลังคา|ท่อ|ฝ้า|พื้น|ประตู|หน้าต่าง)/.test(combined)) return 'renovation';

  // Technology / IT
  if (/เทคโนโลยี|ซอฟต์แวร์|คอมพิวเตอร์|ไอที|อิเล็กทรอนิกส์|ระบบสารสนเทศ|เครือข่าย|เซิร์ฟเวอร์|โปรแกรม|แอปพลิเคชัน|ดิจิทัล|อินเทอร์เน็ต|wifi|wi-fi|ระบบ(?:คอม|IT|ไอที)|hardware|software/i.test(combined)) return 'technology';

  // Consulting / design / supervision
  if (/ที่ปรึกษา|ออกแบบ|ควบคุมงาน|สำรวจ|ศึกษา(?:ความเป็นไปได้|ออกแบบ)|จัดทำแผน|วิจัย/.test(combined)) return 'consulting';

  // Logistics / vehicles / transport
  if (/ขนส่ง|โลจิสติก|รถยนต์|รถบัส|รถบรรทุก|รถจักรยานยนต์|เรือ|เครื่องบิน|น้ำมันเชื้อเพลิง|น้ำมัน(?:ดีเซล|เบนซิน)/.test(combined)) return 'logistics';

  // Agriculture / environment
  if (/เกษตร|พืช|ปุ๋ย|เมล็ดพันธุ์|ประมง|ปศุสัตว์|สัตว์น้ำ|ป่าไม้|สิ่งแวดล้อม|บำบัดน้ำเสีย/.test(combined)) return 'agriculture';

  // Cleaning / waste / hygiene
  if (/ทำความสะอาด|กำจัดขยะ|เก็บขยะ|บริการทำความสะอาด|น้ำยาทำความสะอาด|ผ้า(?:ขนหนู|เช็ด)|กระดาษชำระ/.test(combined)) return 'cleaning';

  return 'other';
}

// ── Date from project ID ────────────────────────────────────────────────────
// Project IDs start with YYMMXXXXXXX where YY = last 2 digits of BE year, MM = month (01-12).
// BE year 25YY → CE year = 25YY - 543.
// e.g. 6905... → BE 2569, month 05 → CE 2026-05

function dateFromProjectId(projectId: string): string | null {
  const match = projectId.match(/^(\d{2})(\d{2})/);
  if (!match) return null;
  const beYear = 2500 + parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;
  const ceYear = beYear - 543;
  return `${ceYear}-${String(month).padStart(2, '0')}-15`; // use 15th as mid-month estimate
}

// ── Status from procurement stage ───────────────────────────────────────────

// flowName values that indicate the procurement is still open for bidding
const OPEN_FLOW_KEYWORDS = [
  'ประกาศเชิญชวน',   // invitation to bid
  'เผยแพร่เอกสาร',   // document publication
  'รับซอง',           // receive bids
  'ยื่นเสนอราคา',    // price submission
  'ประกาศราคากลาง',  // price announcement
  'จัดทำร่าง',       // draft TOR
];

// flowName values that indicate completed/closed
const CLOSED_FLOW_KEYWORDS = [
  'จัดทำสัญญา',
  'บริหารสัญญา',
  'ยกเลิกโครงการ',
  'ยกเลิก',
  'อนุมัติสั่งซื้อ',
  'อนุมัติสั่งจ้าง',
  'ประกาศผู้ชนะ',
  'ผู้ชนะ',
  'สั่งซื้อสั่งจ้าง',
];

// Status is derived solely from the procurement stage (flowName), not estimated dates.
// The e-GP flowName reliably tells us whether a project is still accepting bids.
function statusFromFlow(flowName: string = ''): TenderStatus {
  if (CLOSED_FLOW_KEYWORDS.some((k) => flowName.includes(k))) return 'closed';
  if (OPEN_FLOW_KEYWORDS.some((k) => flowName.includes(k))) return 'open';
  // Unknown stage — assume open; daily scrape will update once flowName changes
  return 'open';
}

// ── Deadline estimation ─────────────────────────────────────────────────────

function estimateDeadline(projectDate: string, flowName: string = '', title: string = ''): string {
  let days = 90; // default — Thai gov projects typically run 2-3 months
  if (/เฉพาะเจาะจง/.test(title + flowName)) days = 45; // direct purchase: shorter
  const d = new Date(projectDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── Region inference ────────────────────────────────────────────────────────

export function inferRegion(agency: string = '', title: string = ''): string {
  const combined = agency + ' ' + title;
  const match = (ALL_THAI_PROVINCES as readonly string[]).find((p) => combined.includes(p));
  if (match) return match;
  // Common agency keyword → province mapping
  if (/กรุงเทพ|กทม/.test(combined)) return 'กรุงเทพมหานคร';
  if (/นนทบุรี/.test(combined)) return 'นนทบุรี';
  if (/ปทุมธานี/.test(combined)) return 'ปทุมธานี';
  if (/สมุทรปราการ/.test(combined)) return 'สมุทรปราการ';
  if (/เชียงใหม่/.test(combined)) return 'เชียงใหม่';
  if (/ขอนแก่น/.test(combined)) return 'ขอนแก่น';
  if (/สงขลา/.test(combined)) return 'สงขลา';
  if (/ชลบุรี/.test(combined)) return 'ชลบุรี';
  return 'กรุงเทพมหานคร'; // fallback
}

// ── Main mapper ─────────────────────────────────────────────────────────────

export function mapToTender(raw: RawAnnouncement): Tender {
  const agency = raw.deptSubName ?? raw.announceSubDesc ?? '';
  const region = raw.rdbProvinceMoiName ?? inferRegion(agency, raw.projectName ?? '');

  // Derive the real project date from the ID (not announceDate which is always today)
  const projectDate = dateFromProjectId(raw.projectId) ?? new Date().toISOString().slice(0, 10);

  const flowName = raw.flowName ?? '';
  const deadline = estimateDeadline(projectDate, flowName, raw.projectName ?? '');
  const status = statusFromFlow(flowName);

  return {
    id: raw.projectId,
    title: raw.projectName,
    agency,
    deadline,
    budget: raw.projectMoney ?? raw.priceBuild ?? 0,
    category: mapCategory(raw.typeId, flowName, raw.projectName),
    region,
    description: flowName,
    requirements: [],
    status,
  };
}
