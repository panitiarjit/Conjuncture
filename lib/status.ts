import { STATUS_COLORS } from './theme';
import type { TranslationKey } from './translation-keys';

export type StatusValue =
  | 'open'
  | 'closing_soon'
  | 'closed'
  | 'unknown'
  | 'in_progress'
  | 'completed'
  | 'escrow_held'
  | 'escrow_released';

export interface StatusConfig {
  pill: string;
  dot: string;
  key: TranslationKey;
}

export const STATUS_CONFIG: Record<StatusValue, StatusConfig> = {
  open:            { ...STATUS_COLORS.open,            key: 'status.open' },
  closing_soon:    { ...STATUS_COLORS.closing_soon,    key: 'status.closingSoon' },
  closed:          { ...STATUS_COLORS.closed,          key: 'status.closed' },
  unknown:         { ...STATUS_COLORS.unknown,         key: 'status.unknown' },
  in_progress:     { ...STATUS_COLORS.in_progress,     key: 'status.inProgress' },
  completed:       { ...STATUS_COLORS.completed,       key: 'status.completed' },
  escrow_held:     { ...STATUS_COLORS.escrow_held,     key: 'status.escrowHeld' },
  escrow_released: { ...STATUS_COLORS.escrow_released, key: 'status.escrowReleased' },
};
