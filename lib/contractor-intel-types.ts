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
  // Statistical flag results
  near_ceiling_categories: string[];  // projectTypes where near_ceiling fired (after BH correction)
  near_ceiling_p_values: number[];    // BH-adjusted p-values, parallel to near_ceiling_categories
  single_agency_lock_p: number | null; // one-sided binomial p-value vs market baseline
  flags: {
    single_agency_lock: boolean;
    near_ceiling: boolean;
  };
  flag_count: number;
  computed_at: string;
}
