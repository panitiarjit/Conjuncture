import type { ProcurementType } from './types';

export type ProcurementMethod = 'specific_simple' | 'specific_compare' | 'e_bidding';

// e-GP methodId codes mapped to the application's procurement categories:
//   '02' = วิธีสอบราคา            (price inquiry — specific_compare)
//   '15' = วิธีตลาดอิเล็กทรอนิกส์     (e-market — specific_compare)
//   '16' = ประกวดราคาอิเล็กทรอนิกส์  (e-bidding — e_bidding)
//   '17' = วิธีคัดเลือก / ตลาด      (selection / e-market — specific_compare)
//   '18' = ประกวดราคา            (traditional bidding / selection — e_bidding)
//   '19' = วิธีเฉพาะเจาะจง         (specific / direct award — specific_simple)
//   '20' = งานพัสดุ / จัดทำเอง       (in-house / direct award — specific_simple)
const METHOD_ID_MAP: Record<string, ProcurementMethod> = {
  '02': 'specific_compare',
  '15': 'specific_compare',
  '16': 'e_bidding',
  '17': 'specific_compare',
  '18': 'e_bidding',
  '19': 'specific_simple',
  '20': 'specific_simple',
};

// Resolve method from the e-GP methodId if known; falls back to budget inference.
export function getMethodFromId(methodId: string | undefined): ProcurementMethod | null {
  if (!methodId) return null;
  return METHOD_ID_MAP[methodId] ?? null;
}

// Budget-based fallback per Ministerial Regulation under B.E. 2560:
//   ≤ 500,000 THB  → specific (เฉพาะเจาะจง)
//   ≤ 5,000,000 THB → e-market / price comparison (ตลาดอิเล็กทรอนิกส์)
//   > 5,000,000 THB → e-bidding (ประกวดราคาอิเล็กทรอนิกส์)
export function getProcurementMethod(budget: number): ProcurementMethod {
  if (budget <= 500_000) return 'specific_simple';
  if (budget <= 5_000_000) return 'specific_compare';
  return 'e_bidding';
}

/**
 * Resolves the procurement method accurately using a 3-layer approach:
 * 1. Matches using the e-GP methodId if known.
 * 2. Parses keywords directly from the project title (highly accurate, as Thai government
 *    project titles must state the procurement method).
 * 3. Falls back to budget-based legal threshold limits.
 */
export function resolveMethod(
  title: string | undefined,
  methodId: string | undefined,
  budget: number
): ProcurementMethod {
  // Layer 1: Method ID Mapping
  const methodFromId = getMethodFromId(methodId);
  if (methodFromId) return methodFromId;

  // Layer 2: Scrape method name from Thai project title.
  // specific_compare is checked first: "ประกวดราคาด้วยวิธีการทางอิเล็กทรอนิกส์โดยผ่านผู้ให้บริการตลาดกลาง"
  // starts with "ประกวดราคา" but is actually e-market — must match ผ่านผู้ให้บริการตลาด before e_bidding.
  if (title) {
    if (/ผ่านผู้ให้บริการตลาด|คัดเลือก|ตลาดอิเล็กทรอนิกส์|e-market|สอบราคา|ประกาศเชิญชวนทั่วไป/.test(title)) {
      return 'specific_compare';
    }
    if (/ประกวดราคา|e-bidding|ประกวดแบบ|นานาชาติ/.test(title)) {
      return 'e_bidding';
    }
    if (/เฉพาะเจาะจง|ตกลงราคา|วิธีตกลง|วิธีพิเศษ|กรณีพิเศษ/.test(title)) {
      return 'specific_simple';
    }
  }

  // Layer 3: Budget fallback
  return getProcurementMethod(budget);
}

// Bid bond (หลักประกันซอง) required for e-bidding per B.E. 2560 §48
export function requiresBidBond(budget: number, method?: ProcurementMethod): boolean {
  const resolvedMethod = method ?? getProcurementMethod(budget);
  return resolvedMethod === 'e_bidding';
}

/**
 * Resolves the procurement type (ประเภทการจัดหา) from the Thai project title.
 * Highly accurate because Thai government project titles always start with the type of action/procurement.
 */
export function resolveProcurementType(title: string | undefined): ProcurementType {
  if (title) {
    if (/^ซื้อ/.test(title)) return 'purchase';
    if (/^จ้างก่อสร้าง|^จ้างเหมาก่อสร้าง/.test(title)) return 'construction';
    if (/^จ้างออกแบบและควบคุมงานก่อสร้าง|^จ้างออกแบบและควบคุมงาน/.test(title)) return 'design_supervision';
    if (/^จ้างออกแบบ/.test(title)) return 'design';
    if (/^จ้างควบคุมงาน|^จ้างผู้ควบคุมงาน/.test(title)) return 'supervision';
    if (/^จ้างที่ปรึกษา/.test(title)) return 'consulting';
    if (/^จ้างทำของ|^จ้างเหมาบริการ|^จ้างเหมาบุคคล|^จ้าง/.test(title)) return 'services';
    if (/^เช่า/.test(title)) return 'rent';
  }
  return 'services'; // Default fallback
}
