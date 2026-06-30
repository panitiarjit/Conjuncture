/** Contractor signal shape — written by scripts/analyze-contractors.ts, read by API and data-service. */
export interface ContractorSignal {
  winnerName: string;
  winnerBusinessId: string | null;
  win_count: number;
  total_value_thb: number;
  fiscal_years: number[];
  agencies: { agency: string; count: number }[];
  top_agency: string;
  top_agency_pct: number;
  median_discount: number;
  near_ceiling_rate: number;
  flags: {
    single_agency_lock: boolean;
    near_ceiling: boolean;
    high_volume: boolean;
  };
  flag_count: number;
  computed_at: string;
}
