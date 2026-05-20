'use client';

import React from 'react';
import { ShieldCheck, Star } from 'lucide-react';
import type { VendorVerified } from '@/lib/types';
import { VERIFIED_COLORS } from '@/lib/theme';

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
      <span className={`inline-flex items-center gap-1 ${paddingClass} ${textClass} font-medium rounded-full border ${VERIFIED_COLORS.new}`}>
        New Vendor
      </span>
    );
  }

  if (tier === 'verified') {
    return (
      <span className={`inline-flex items-center gap-1 ${paddingClass} ${textClass} font-medium rounded-full border ${VERIFIED_COLORS.verified}`}>
        <ShieldCheck size={iconSize} aria-hidden="true" />
        Verified
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${paddingClass} ${textClass} font-medium rounded-full border ${VERIFIED_COLORS.verified_pro}`}>
      <Star size={iconSize} aria-hidden="true" />
      <ShieldCheck size={iconSize} aria-hidden="true" />
      Verified Pro
    </span>
  );
}
