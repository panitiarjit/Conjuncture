import type { TenderStatus, ProjectStatus, Tender } from './types';

export function computeTenderStatus(deadline: string): TenderStatus {
  const diffDays = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (diffDays <= 0) return 'closed';
  if (diffDays <= 7) return 'closing_soon';
  return 'open';
}

// Use this instead of computeTenderStatus for real tenders — respects the stored
// flowName-based status while still surfacing 'closing_soon' for the 7-day window.
export function getDisplayStatus(tender: Pick<Tender, 'status' | 'deadline'>): TenderStatus {
  if (tender.status === 'closed') return 'closed';
  if (getDaysRemaining(tender.deadline) <= 7) return 'closing_soon';
  return 'open';
}

export function getDaysRemaining(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}

export function computeProjectStatus(deadline: string, baseStatus: ProjectStatus): ProjectStatus {
  if (baseStatus === 'completed' || baseStatus === 'in_progress') return baseStatus;
  return getDaysRemaining(deadline) === 0 ? 'completed' : 'open';
}
