"use client";

import { useEffect, useState } from "react";

// Module-level cache so mounting this hook in multiple landing-page
// components (Hero, Footer, CaseStudy, ...) only fires one fetch, not one
// per component. The API route is itself cached 24h server-side, so this
// is just avoiding redundant client-side round trips.
let cached: number | null = null;
let inflight: Promise<number> | null = null;

async function fetchTotalCount(): Promise<number> {
  if (cached !== null) return cached;
  if (!inflight) {
    inflight = fetch("/api/stats/total-count")
      .then((res) => res.json())
      .then((data: { total: number }) => {
        cached = data.total;
        return cached;
      })
      .catch(() => 0);
  }
  return inflight;
}

/**
 * Live count of records across cgd_contracts + tenders + soe_tenders.
 * Returns `fallback` (formatted) until the real number loads, so the
 * landing page never flashes "0" or an empty string.
 */
export function useTotalCount(fallback = 549_000): { value: number; formatted: string } {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    let cancelled = false;
    fetchTotalCount().then((total) => {
      if (!cancelled && total > 0) setValue(total);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { value, formatted: `${value.toLocaleString("en-US")}+` };
}
