'use client';

import React from 'react';

function Bone({ className }: { className: string }) {
  return <div className={`bg-[#E0E0E0] rounded animate-pulse ${className}`} />;
}

export default function ProjectCardSkeleton() {
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
        <Bone className="h-4 w-3/4" />
      </div>

      {/* budget */}
      <Bone className="h-4 w-2/5" />

      {/* 3 small meta chips */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <Bone className="h-3 w-20" />
        <Bone className="h-3 w-16" />
        <Bone className="h-3 w-14" />
      </div>

      {/* avatar + name */}
      <div className="flex items-center gap-2">
        <Bone className="h-7 w-7 rounded-full flex-shrink-0" />
        <Bone className="h-3 w-32" />
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
