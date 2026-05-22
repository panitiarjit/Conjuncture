import type { Tender, ProjectCategory, TenderStatus } from '../types';
import { ALL_THAI_PROVINCES } from '../data-utils';
import type { RawAnnouncement } from './types';

// ── Category mapping ────────────────────────────────────────────────────────

export function mapCategory(typeId: string | null | undefined, flowName: string | undefined, title: string | undefined): ProjectCategory {
  const combined = `${typeId ?? ''} ${flowName ?? ''} ${title ?? ''}`;
  if (/ก่อสร้าง|ซ่อมแซม|ปรับปรุง|สร้าง/.test(combined)) return 'construction';
  if (/ที่ปรึกษา|ออกแบบ|ควบคุมงาน/.test(combined)) return 'consulting';
  if (/เทคโนโลยี|ซอฟต์แวร์|คอมพิวเตอร์|ไอที|อิเล็กทรอนิกส์/i.test(combined)) return 'technology';
  if (/ขนส่ง|โลจิสติก|รถ/.test(combined)) return 'logistics';
  if (/เกษตร/.test(combined)) return 'agriculture';
  if (/ทำความสะอาด/.test(combined)) return 'cleaning';
  if (/ปรับปรุง|ซ่อม|ต่อเติม/.test(combined)) return 'renovation';
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

function statusFromFlow(flowName: string = '', projectDate: string): TenderStatus {
  const isOpen = OPEN_FLOW_KEYWORDS.some((k) => flowName.includes(k));
  if (isOpen) {
    const dlDate = new Date(projectDate);
    dlDate.setDate(dlDate.getDate() + 30);
    return new Date() > dlDate ? 'closed' : 'open';
  }
  const isClosed = CLOSED_FLOW_KEYWORDS.some((k) => flowName.includes(k));
  if (isClosed) return 'closed';
  // Unknown stage — treat as open if project date is recent (< 60 days ago)
  const daysOld = (Date.now() - new Date(projectDate).getTime()) / 86_400_000;
  return daysOld < 60 ? 'open' : 'closed';
}

// ── Deadline estimation ─────────────────────────────────────────────────────

function estimateDeadline(projectDate: string, flowName: string = '', title: string = ''): string {
  let days = 30;
  if (/ประกวดราคา|e-Bidding|อิเล็กทรอนิกส์/i.test(title + flowName)) days = 45;
  if (/เฉพาะเจาะจง/.test(title + flowName)) days = 15;
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
  const status = statusFromFlow(flowName, projectDate);

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
