'use client';

import React from 'react';
import { useLanguage } from '@/lib/language-context';
import { STATUS_CONFIG, type StatusValue } from '@/lib/status';

interface StatusPillProps {
  status: StatusValue;
  label?: string;
}

export default function StatusPill({ status, label }: StatusPillProps) {
  const { t } = useLanguage();
  const config = STATUS_CONFIG[status];
  const displayLabel = label ?? t(config.key);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.pill}`}
    >
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`}
        aria-hidden="true"
      />
      {displayLabel}
    </span>
  );
}
