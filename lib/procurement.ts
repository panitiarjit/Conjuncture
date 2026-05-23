export type ProcurementMethod = 'specific_simple' | 'specific_compare' | 'e_bidding';

// e-GP methodId codes confirmed from live API responses (dry-run 2026-05-24):
//   '19' = วิธีเฉพาะเจาะจง  (specific — direct award)
//   '16' = ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)
// Add new codes here as they are observed in scraper dry-run output.
const METHOD_ID_MAP: Record<string, ProcurementMethod> = {
  '19': 'specific_simple',
  '16': 'e_bidding',
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

// Bid bond (หลักประกันซอง) required for e-bidding per B.E. 2560 §48
export function requiresBidBond(budget: number): boolean {
  return getProcurementMethod(budget) === 'e_bidding';
}
