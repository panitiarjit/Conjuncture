import type { TenderStatus, ProjectStatus } from './types';

export function computeTenderStatus(deadline: string): TenderStatus {
  const diffDays = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000);
  if (diffDays <= 0) return 'closed';
  if (diffDays <= 7) return 'closing_soon';
  return 'open';
}

export function getDaysRemaining(deadline: string): number {
  return Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000));
}

export function computeProjectStatus(deadline: string, baseStatus: ProjectStatus): ProjectStatus {
  if (baseStatus === 'completed' || baseStatus === 'in_progress') return baseStatus;
  return getDaysRemaining(deadline) === 0 ? 'completed' : 'open';
}
