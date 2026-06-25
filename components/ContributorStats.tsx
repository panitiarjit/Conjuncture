'use client';

import { useEffect, useState } from 'react';
import type { ContributorStats } from '@/lib/types';

const DEFAULT: ContributorStats = {
  outcome_reports: 0,
  community_reports: 0,
  agencies_improved: 0,
  anomalies_verified: 0,
  last_updated: '',
};

function AnimatedCount({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value === 0) return;
    let frame: number;
    const start = Date.now();
    const duration = 1200;
    const animate = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) frame = requestAnimationFrame(animate);
      else setDisplay(value);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

export function ContributorStats() {
  const [stats, setStats] = useState<ContributorStats>(DEFAULT);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/contributor-stats')
      .then((r) => r.json())
      .then((data: ContributorStats) => {
        setStats(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const total = stats.outcome_reports + stats.community_reports;
  if (!loaded || total === 0) return null;

  return (
    <div className="border-b border-[#E0E0E0] pb-6 mb-6">
      <p className="text-xs text-[#717171] uppercase tracking-widest mb-3 font-medium">
        ชุมชนผู้ใช้ช่วยพัฒนาโมเดล
      </p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        <Stat
          loaded={loaded}
          value={stats.outcome_reports}
          label="รายงานผลประมูล"
        />
        <Stat
          loaded={loaded}
          value={stats.community_reports}
          label="รายงานจากชุมชน"
        />
        {stats.agencies_improved > 0 && (
          <Stat
            loaded={loaded}
            value={stats.agencies_improved}
            label="หน่วยงานที่ปรับปรุงแล้ว"
          />
        )}
        {stats.anomalies_verified > 0 && (
          <Stat
            loaded={loaded}
            value={stats.anomalies_verified}
            label="ข้อผิดปกติที่ยืนยัน"
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  loaded,
  value,
  label,
}: {
  loaded: boolean;
  value: number;
  label: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[#111111] font-semibold text-lg leading-tight">
        {loaded ? <AnimatedCount value={value} /> : '—'}
      </span>
      <span className="text-[#717171] text-xs">{label}</span>
    </div>
  );
}
