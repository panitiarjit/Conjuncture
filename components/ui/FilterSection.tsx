'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FilterSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export default function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#E0E0E0] pb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-2 text-sm font-semibold text-[#111111] hover:text-[#717171] transition-colors"
        aria-expanded={open}
      >
        {title}
        <ChevronDown
          size={15}
          className={`text-[#717171] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="mt-3 flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}
