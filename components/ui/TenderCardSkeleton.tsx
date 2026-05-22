'use client';

import React from 'react';

function Bone({ className }: { className: string }) {
  return <div className={`bg-[#E0E0E0] rounded animate-pulse ${className}`} />;
}

export default function TenderCardSkeleton() {
  return (
    <div className="card flex flex-col gap-4" aria-hidden="true">
      {/* badge + status */}
      <div className="flex items-start justify-between gap-2">
        <Bone className="h-5 w-20 rounded-full" />
        <Bone className="h-5 w-16 rounded-full" />
      </div>

      {/* title */}
      <div className="flex flex-col gap-1.5">
        <Bone className="h-4 w-full" />
        <Bone className="h-4 w-4/5" />
      </div>

      {/* agency */}
      <Bone className="h-3.5 w-2/3" />

      {/* 4 meta rows */}
      <div className="flex flex-col gap-2.5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Bone className="h-3 w-16" />
            <Bone className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* divider */}
      <div className="h-px bg-[#E0E0E0]" />

      {/* actions */}
      <div className="flex items-center justify-between gap-3">
        <Bone className="h-4 w-20" />
        <Bone className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  );
}
