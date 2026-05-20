'use client';

import React from 'react';
import { ShieldCheck, Star } from 'lucide-react';
import type { VendorVerified } from '@/lib/mock-data';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerifiedBadgeProps {
  tier: VendorVerified;
  size?: 'sm' | 'md';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VerifiedBadge({ tier, size = 'md' }: VerifiedBadgeProps) {
  const iconSize = size === 'sm' ? 11 : 13;
  const textClass = size === 'sm' ? 'text-[11px]' : 'text-xs';
  const paddingClass = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';

  if (tier === 'new') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${paddingClass} ${textClass} font-medium rounded-full border border-[#E0E0E0] bg-[#F7F7F7] text-[#717171]`}
      >
        New Vendor
      </span>
    );
  }

  if (tier === 'verified') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${paddingClass} ${textClass} font-medium rounded-full border border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]`}
      >
        <ShieldCheck size={iconSize} aria-hidden="true" />
        Verified
      </span>
    );
  }

  // verified_pro
  return (
    <span
      className={`inline-flex items-center gap-1 ${paddingClass} ${textClass} font-medium rounded-full border border-[#111111] bg-[#111111] text-white`}
    >
      <Star size={iconSize} aria-hidden="true" />
      <ShieldCheck size={iconSize} aria-hidden="true" />
      Verified Pro
    </span>
  );
}
