import { NextResponse } from 'next/server';
import { getAwardedContracts } from '@/lib/data-service';
import { buildBenchmarkTables } from '@/lib/bidsight-core';

export async function GET() {
  try {
    const contracts = await getAwardedContracts(undefined, 10_000);
    const { category } = buildBenchmarkTables(contracts);

    const result = Array.from(category.entries())
      .map(([id, table]) => ({ id, n: table.n, median: table.median }))
      .sort((a, b) => b.n - a.n);

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600' },
    });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
