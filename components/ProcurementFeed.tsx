'use client';

import { useEffect, useRef, useState } from 'react';

type Signal = {
  tag: string;
  tagColor: string;
  text: string;
  meta: string;
};

type LiveSignal = Signal & {
  insertedAt: number;
  isNew: boolean;
};

const SIGNALS: Signal[] = [
  { tag: 'ANOMALY', tagColor: 'text-red-500 bg-red-50', text: 'อบต.เสมา awarded ฿46.1M road contract for ฿461,330 — 99% below reference price', meta: 'FY2567 · Nakhon Ratchasima' },
  { tag: 'TREND', tagColor: 'text-amber-600 bg-amber-50', text: 'Median procurement discount: 13.12% in FY2561 → 0.06% in FY2567. 218× collapse in 6 years.', meta: '251,000+ contracts · e-GP system' },
  { tag: 'PATTERN', tagColor: 'text-violet-600 bg-violet-50', text: 'นางฑาณะมาศ หนูอ้น won 4 child development center contracts at 97% discount each. Same reference price: ฿308,700.', meta: 'FY2567 · Phichit province' },
  { tag: 'PROVINCE', tagColor: 'text-blue-600 bg-blue-50', text: 'Phichit median discount: 10.91%. Saraburi: 0.09%. Same country, same law — 121× gap.', meta: '77 provinces analyzed' },
  { tag: 'AGENCY', tagColor: 'text-slate-600 bg-slate-100', text: 'Department of Highways: 63.9% of contracts settled within 0.5% of reference price, despite using competitive e-bidding.', meta: '310 contracts · กรมทางหลวง' },
  { tag: 'ANOMALY', tagColor: 'text-red-500 bg-red-50', text: 'State Railway of Thailand supervision contract: ฿604M reference price, won at 81.5% discount. Z-score: 7.73.', meta: 'FY2567 · Khon Kaen–Nong Khai line' },
  { tag: 'MARKET', tagColor: 'text-emerald-600 bg-emerald-50', text: '฿1M–10M projects show 3.28% median discount. Projects over ฿100M: 1.01%. Larger ≠ more competitive.', meta: '9,708 contracts in mid-tier' },
  { tag: 'PATTERN', tagColor: 'text-violet-600 bg-violet-50', text: '57% of 4,003 agencies analyzed have a single winning vendor across all their contracts.', meta: '2,275 agencies · single-vendor lock-in' },
  { tag: 'ANOMALY', tagColor: 'text-red-500 bg-red-50', text: 'กรมการแพทย์ eye medication procurement: ฿185M reference, awarded for ฿2.8M. Off-patent generics drove 98.5% discount.', meta: 'FY2567 · Medical Department' },
  { tag: 'TREND', tagColor: 'text-amber-600 bg-amber-50', text: '36.1% of e-bidding contracts end within 0.5% of reference price — statistically indistinguishable from no competition.', meta: '1,070 e-bidding contracts' },
  { tag: 'AGENCY', tagColor: 'text-slate-600 bg-slate-100', text: 'Royal Irrigation Department: 32% of 1,639 contracts at near-zero discount. Designed for competition, functioning as fixed-price.', meta: 'กรมชลประทาน · FY2561–2568' },
  { tag: 'PROVINCE', tagColor: 'text-blue-600 bg-blue-50', text: 'Samut Songkhram median discount: 10.26%. Five provinces under 0.3%. Bangkok average: 2.1%.', meta: 'Provincial breakdown · 77 provinces' },
  { tag: 'MARKET', tagColor: 'text-emerald-600 bg-emerald-50', text: 'Design contracts: 15% median discount — highest of any project type. Service contracts: 0.08%. Design = most competitive market.', meta: '23 design contracts analyzed' },
  { tag: 'ANOMALY', tagColor: 'text-red-500 bg-red-50', text: 'กองทัพบก pharmaceutical procurement: ฿29.7M reference, won at 72.4% discount. Z-score: 7.95.', meta: 'FY2567 · Royal Thai Army' },
  { tag: 'PATTERN', tagColor: 'text-violet-600 bg-violet-50', text: '812 contracts flagged with Z-score > 3 vs agency median. Top anomaly: 8.70 standard deviations from normal.', meta: '19,773 valid contracts screened' },
  { tag: 'TREND', tagColor: 'text-amber-600 bg-amber-50', text: 'FY2563 median: 5.53%. FY2567: 0.06%. The collapse accelerated post-2020 across all contract types.', meta: 'Year-on-year analysis · e-GP' },
  { tag: 'AGENCY', tagColor: 'text-slate-600 bg-slate-100', text: 'State Railway of Thailand: 70.7% of 116 contracts at near-zero discount. Highest near-zero rate of any major agency.', meta: 'การรถไฟแห่งประเทศไทย' },
  { tag: 'MARKET', tagColor: 'text-emerald-600 bg-emerald-50', text: 'Contracts under ฿100k: median discount 0%. 1,216 contracts analyzed. No competitive pressure at micro scale.', meta: 'Budget tier analysis · FY2561–2568' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function timeAgo(ts: number, now: number): string {
  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 30) return 'just now';
  if (diffSec < 90) return '1m ago';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

const INITIAL_OFFSETS = [2, 5, 8, 12, 17, 23, 31, 42].map(m => m * 60 * 1000);

export default function ProcurementFeed() {
  const now = Date.now();

  const [items, setItems] = useState<LiveSignal[]>(() =>
    shuffle(SIGNALS).slice(0, 8).map((s, i) => ({
      ...s,
      insertedAt: now - INITIAL_OFFSETS[i],
      isNew: false,
    }))
  );
  const [entering, setEntering] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const poolRef = useRef<Signal[]>(shuffle(SIGNALS));
  const poolIdxRef = useRef(0);

  useEffect(() => {
    // Re-render timestamps every 30s
    tickRef.current = setInterval(() => setTick(t => t + 1), 30_000);

    // Insert new signal every 2.8s
    intervalRef.current = setInterval(() => {
      if (poolIdxRef.current >= poolRef.current.length) {
        poolRef.current = shuffle(SIGNALS);
        poolIdxRef.current = 0;
      }
      const next = poolRef.current[poolIdxRef.current++];
      const insertAt = Math.floor(Math.random() * 3);

      setEntering(insertAt);
      setItems((prev) => {
        const updated = [...prev];
        updated.splice(insertAt, 0, { ...next, insertedAt: Date.now(), isNew: true });
        return updated.slice(0, 8).map((item, i) => ({
          ...item,
          isNew: i === insertAt ? item.isNew : false,
        }));
      });

      setTimeout(() => {
        setEntering(null);
        setItems(prev => prev.map((item, i) => i === insertAt ? { ...item, isNew: false } : item));
      }, 2000);
    }, 2800);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  const nowTs = Date.now() + tick * 0; // tick forces re-render

  return (
    <div className="bg-white rounded-xl border border-[#E0E0E0] p-5 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-red-500" />
          </span>
          <h2 className="text-sm font-semibold text-[#111111]">Live procurement signals</h2>
        </div>
        <span className="text-xs text-[#717171]">251,000+ contracts · e-GP · FY2561–2568</span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={`${item.text.slice(0, 20)}-${i}`}
            className={`flex gap-3 items-start px-3 py-2.5 rounded-lg bg-[#F7F7F7] transition-all duration-300 ${
              entering === i ? 'opacity-0 -translate-y-1' : 'opacity-100 translate-y-0'
            }`}
          >
            <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider mt-0.5 ${item.tagColor}`}>
              {item.tag}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-[#111111] leading-relaxed">{item.text}</p>
                <span className={`flex-shrink-0 text-[10px] font-medium mt-0.5 ${item.isNew ? 'text-emerald-500' : 'text-[#B0B0B0]'}`}>
                  {item.isNew ? 'new' : timeAgo(item.insertedAt, nowTs)}
                </span>
              </div>
              <p className="text-[10px] text-[#717171] mt-0.5">{item.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
