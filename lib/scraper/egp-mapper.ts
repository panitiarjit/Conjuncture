import type { Tender, ProjectCategory } from '../types';
import { ALL_THAI_PROVINCES } from '../data-utils';
import type { RawAnnouncement } from './types';

export function mapCategory(typeId: string | null | undefined, flowName: string | undefined): ProjectCategory {
  const combined = `${typeId ?? ''} ${flowName ?? ''}`;
  if (/ก่อสร้าง/.test(combined)) return 'construction';
  if (/ที่ปรึกษา|ออกแบบ|ควบคุมงาน/.test(combined)) return 'consulting';
  if (/เทคโนโลยี|ซอฟต์แวร์|คอมพิวเตอร์|ไอที/i.test(combined)) return 'technology';
  if (/ขนส่ง|โลจิสติก/.test(combined)) return 'logistics';
  if (/เกษตร/.test(combined)) return 'agriculture';
  if (/ทำความสะอาด/.test(combined)) return 'cleaning';
  return 'other';
}

export function inferRegion(agency: string = ''): string {
  const match = (ALL_THAI_PROVINCES as readonly string[]).find((p) => agency.includes(p));
  return match ?? 'กรุงเทพมหานคร';
}

export function mapToTender(raw: RawAnnouncement): Tender {
  const agency = raw.deptSubName ?? raw.announceSubDesc ?? '';
  const region = raw.rdbProvinceMoiName ?? inferRegion(agency);

  // announceDate is the announcement start date; we add 30 days as deadline estimate
  const announceDate = raw.announceDate ? raw.announceDate.slice(0, 10) : '';
  let deadline = '';
  if (announceDate) {
    const d = new Date(announceDate);
    d.setDate(d.getDate() + 30);
    deadline = d.toISOString().slice(0, 10);
  }

  const now = new Date();
  const dlDate = deadline ? new Date(deadline) : null;
  const status = !dlDate || dlDate < now ? 'closed' : 'open';

  return {
    id: raw.projectId,
    title: raw.projectName,
    agency,
    deadline,
    budget: raw.projectMoney ?? raw.priceBuild ?? 0,
    category: mapCategory(raw.typeId, raw.flowName),
    region,
    description: [raw.flowName, raw.announceType].filter(Boolean).join(' · '),
    requirements: [],
    status,
  };
}
