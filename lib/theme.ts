// Single source of truth for all Tailwind color tokens used across the app.
// Import from here instead of writing raw hex strings in components.

import type { StatusValue } from './status';
import type { VendorVerified } from './types';
import type { ProcurementMethod } from './procurement';

// ─── Status pills and dots ─────────────────────────────────────────────────────

export const STATUS_COLORS: Record<StatusValue, { pill: string; dot: string }> = {
  open:             { pill: 'bg-[#d8f3dc] text-[#2D6A4F] border border-[#b7e4c7]',   dot: 'bg-[#2D6A4F]' },
  closed:           { pill: 'bg-[#F7F7F7] text-[#717171] border border-[#E0E0E0]',   dot: 'bg-[#717171]' },
  unknown:          { pill: 'bg-[#F3F0FF] text-[#6D28D9] border border-[#DDD6FE]',   dot: 'bg-[#6D28D9]' },
  in_progress:      { pill: 'bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]',   dot: 'bg-[#1D4ED8]' },
  completed:        { pill: 'bg-[#F7F7F7] text-[#717171] border border-[#E0E0E0]',   dot: 'bg-[#717171]' },
  escrow_held:      { pill: 'bg-[#fef3c7] text-[#B45309] border border-[#fde68a]',   dot: 'bg-[#B45309]' },
  escrow_released:  { pill: 'bg-[#d8f3dc] text-[#2D6A4F] border border-[#b7e4c7]',   dot: 'bg-[#2D6A4F]' },
};

// ─── Procurement method badges ─────────────────────────────────────────────────

export const METHOD_COLORS: Record<ProcurementMethod, string> = {
  specific_simple: 'bg-[#D8F3DC] text-[#2D6A4F] border-[#B7E4C7]',
  specific_compare: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
  e_bidding: 'bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]',
};

// ─── Verified vendor badges ────────────────────────────────────────────────────

export const VERIFIED_COLORS: Record<VendorVerified, string> = {
  new:          'border-[#E0E0E0] bg-[#F7F7F7] text-[#717171]',
  verified:     'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
  verified_pro: 'border-[#111111] bg-[#111111] text-white',
};

// ─── Milestone step colors ─────────────────────────────────────────────────────

export const MILESTONE_COLORS = {
  complete: { ring: 'bg-[#2D6A4F]', text: 'text-[#2D6A4F]', line: 'bg-[#2D6A4F]' },
  active:   { ring: 'bg-[#1D4ED8]', text: 'text-[#1D4ED8]', line: 'bg-[#E0E0E0]' },
  pending:  { ring: 'bg-[#E0E0E0]', text: 'text-[#717171]', line: 'bg-[#E0E0E0]' },
} as const;

export type MilestoneStatus = keyof typeof MILESTONE_COLORS;

// ─── Semantic palette (shared primitives) ──────────────────────────────────────

export const PALETTE = {
  green:  { bg: '#2D6A4F', light: '#d8f3dc', border: '#b7e4c7' },
  amber:  { bg: '#B45309', light: '#fef3c7', border: '#fde68a' },
  blue:   { bg: '#1D4ED8', light: '#EFF6FF', border: '#BFDBFE' },
  neutral: { bg: '#717171', light: '#F7F7F7', border: '#E0E0E0' },
  ink:    { bg: '#111111' },
} as const;
