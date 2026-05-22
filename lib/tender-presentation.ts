// Single seam for everything a UI needs to display a Tender.
// Callers receive a TenderPresentation and never import deadline, procurement, or format separately.

import type { Tender } from './types';
import type { TenderStatus } from './types';
import type { ProcurementMethod } from './procurement';
import { getDisplayStatus, getDaysRemaining } from './deadline';
import { getProcurementMethod } from './procurement';
import { formatBudget, formatDate } from './format';
import { METHOD_COLORS, STATUS_COLORS } from './theme';
import { CATEGORY_KEYS } from './translation-keys';
import type { TranslationKey } from './translation-keys';

export interface TenderPresentation {
  status: TenderStatus;
  statusPillClass: string;
  statusDotClass: string;
  daysRemaining: number;
  isClosingSoon: boolean;
  procurementMethod: ProcurementMethod;
  methodBadgeClass: string;
  categoryLabel: string;
  formattedBudget: string;
  formattedDeadline: string;
}

export function getTenderPresentation(
  tender: Tender,
  t: (key: TranslationKey) => string,
): TenderPresentation {
  const status = getDisplayStatus(tender);
  const daysRemaining = getDaysRemaining(tender.deadline);
  const procurementMethod = getProcurementMethod(tender.budget);
  const categoryLabel = t(CATEGORY_KEYS[tender.category]);

  return {
    status,
    statusPillClass: STATUS_COLORS[status].pill,
    statusDotClass: STATUS_COLORS[status].dot,
    daysRemaining,
    isClosingSoon: status === 'closing_soon',
    procurementMethod,
    methodBadgeClass: METHOD_COLORS[procurementMethod],
    categoryLabel,
    formattedBudget: formatBudget(tender.budget),
    formattedDeadline: formatDate(tender.deadline),
  };
}
