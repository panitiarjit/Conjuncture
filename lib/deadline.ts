import type { TenderStatus, Tender } from './types';

export function computeTenderStatus(deadline: string): TenderStatus {
  const diffDays = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (diffDays <= 0) return 'closed';
  if (diffDays <= 7) return 'closing_soon';
  return 'open';
}

// Status comes entirely from e-GP flowName/announceWinnerDate set during scrape.
// Deadline is not used for display — it is an estimate only.
export function getDisplayStatus(tender: Pick<Tender, 'status'>): TenderStatus {
  return tender.status;
}

export function getDaysRemaining(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}
