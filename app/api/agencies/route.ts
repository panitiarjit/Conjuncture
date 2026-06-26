import { NextResponse } from 'next/server';
import { getContractsForBenchmark } from '@/lib/data-service';
import { buildBenchmarkTables } from '@/lib/bidsight-core';

export async function GET() {
  try {
    const contracts = await getContractsForBenchmark();
    const { agencyCategory } = buildBenchmarkTables(contracts);

    // Aggregate total n per agency across all categories
    const agencyMap = new Map<string, number>();
    for (const [key, table] of agencyCategory) {
      const agency = key.split('|')[0];
      agencyMap.set(agency, (agencyMap.get(agency) ?? 0) + table.n);
    }

    const result = Array.from(agencyMap.entries())
      .map(([agency, n]) => ({ agency, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 300);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return NextResponse.json([]);
  }
}
