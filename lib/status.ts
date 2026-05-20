export type StatusValue =
  | 'open'
  | 'closing_soon'
  | 'closed'
  | 'in_progress'
  | 'completed'
  | 'escrow_held'
  | 'escrow_released';

export interface StatusConfig {
  pill: string;
  dot: string;
  key: string;
}

export const STATUS_CONFIG: Record<StatusValue, StatusConfig> = {
  open: {
    pill: 'bg-[#d8f3dc] text-[#2D6A4F] border border-[#b7e4c7]',
    dot: 'bg-[#2D6A4F]',
    key: 'status.open',
  },
  closing_soon: {
    pill: 'bg-[#fef3c7] text-[#B45309] border border-[#fde68a]',
    dot: 'bg-[#B45309]',
    key: 'status.closingSoon',
  },
  closed: {
    pill: 'bg-[#F7F7F7] text-[#717171] border border-[#E0E0E0]',
    dot: 'bg-[#717171]',
    key: 'status.closed',
  },
  in_progress: {
    pill: 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]',
    dot: 'bg-[#1D4ED8]',
    key: 'status.inProgress',
  },
  completed: {
    pill: 'bg-[#F7F7F7] text-[#717171] border border-[#E0E0E0]',
    dot: 'bg-[#717171]',
    key: 'status.completed',
  },
  escrow_held: {
    pill: 'bg-[#fef3c7] text-[#B45309] border border-[#fde68a]',
    dot: 'bg-[#B45309]',
    key: 'status.escrowHeld',
  },
  escrow_released: {
    pill: 'bg-[#d8f3dc] text-[#2D6A4F] border border-[#b7e4c7]',
    dot: 'bg-[#2D6A4F]',
    key: 'status.escrowReleased',
  },
};
