export type ProcurementMethod = 'specific_simple' | 'specific_compare' | 'e_bidding';

export function getProcurementMethod(budget: number): ProcurementMethod {
  if (budget <= 100_000) return 'specific_simple';
  if (budget <= 500_000) return 'specific_compare';
  return 'e_bidding';
}

// e-bidding requires a bid bond (หลักประกันซอง) per B.E. 2560 §48
export function requiresBidBond(budget: number): boolean {
  return getProcurementMethod(budget) === 'e_bidding';
}
