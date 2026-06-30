// Domain types for the Conjuncture procurement analytics platform.

export type TenderStatus = 'open' | 'closing_soon' | 'closed' | 'unknown';

export type ProcurementType =
  | 'purchase'
  | 'construction'
  | 'services'
  | 'rent'
  | 'consulting'
  | 'design'
  | 'supervision'
  | 'design_supervision';

export type ProjectCategory =
  | 'renovation'
  | 'technology'
  | 'logistics'
  | 'agriculture'
  | 'cleaning'
  | 'construction'
  | 'consulting'
  | 'medical'
  | 'education'
  | 'food'
  | 'security'
  | 'other';

export interface Tender {
  id: string;
  title: string;
  agency: string;
  deadline: string;
  budget: number;
  category: ProjectCategory;
  region: string;
  description: string;
  requirements: string[];
  // Source of truth for open/closed — derived from e-GP flowName during scrape.
  // Display layer adds 'closing_soon' when status==='open' and deadline < 7 days out.
  status: TenderStatus;
  // Raw e-GP method code (e.g. "16" = specific, "15" = e-bidding). Stored for future
  // use; procurement method display currently falls back to budget-based inference.
  methodId?: string;
  procurementType?: ProcurementType;
  announceType?: string;
}

export interface Category {
  id: ProjectCategory;
  name: string;
  icon: string;
  count: number;
}

// ── State-owned enterprise tenders (soe_tenders Firestore collection) ────────
// Field names match Python TenderRecord snake_case exactly as written by import_to_firestore.py.
// Optional fields are absent from documents where the value was null at scrape time.
export interface SoeTender {
  id: string;               // Firestore document ID = tender_id
  source: string;           // "BMA" | "MEA" | "EGAT" | "PTT" | "PWA" | "PEA" | "MRTA"
  title: string;
  department?: string;
  budget?: number;
  winning_bid?: number;
  winner_name?: string;
  method?: string;
  category?: string;
  announcement_date?: string;
  submission_deadline?: string;
  award_date?: string;
  announcement_url?: string;
  status?: string;           // "open" | "awarded"
  scraped_at?: string;
  imported_at?: string;
}

// ── Data network effect types ─────────────────────────────────────────────────

/** Anonymous simulator usage log. Stored in simulator_inputs collection. */
export interface SimulatorInput {
  id?: string;
  session_id: string;
  timestamp: string;
  project_type: string;
  agency_category: string;
  budget_bucket: string;      // "<1M" | "1-5M" | "5-20M" | "20-100M" | ">100M"
  cost_ratio: number;         // % of ceiling price
  min_margin: number;         // % minimum acceptable
  market_position: number;    // percentile selected
  recommended_bid: number;    // output in baht
  recommended_discount: number; // % from ceiling
}

export type BidOutcomeType = 'won' | 'lost' | 'no_bid' | 'pending';

/** Contractor-submitted bid outcome. Stored in bid_outcomes collection. */
export interface BidOutcome {
  id?: string;
  outcome_id: string;
  session_id: string;
  timestamp: string;
  outcome_type: BidOutcomeType;
  project_type?: string;
  agency?: string;
  submitted_price?: number;
  winner_price?: number;
  competitor_count?: number;
  no_bid_reason?: string;
  verified: boolean;
  source: 'simulator_prompt' | 'manual' | 'bulk_import';
}

export type CommunityReportType = 'suspicious' | 'data_error' | 'analysis_request' | 'bid_outcome';
export type CommunityReportStatus = 'new' | 'reviewing' | 'verified' | 'published' | 'dismissed';

/** Community-submitted report. Stored in community_reports collection. */
export interface CommunityReport {
  id?: string;
  report_id: string;
  report_type: CommunityReportType;
  timestamp: string;
  agency?: string;
  fiscal_year?: string;
  project_ref?: string;
  content: Record<string, unknown>;
  submitter_email?: string;
  submitter_role?: string;
  status: CommunityReportStatus;
  internal_notes?: string;
}

export type CrowdAnomalyPattern = 'consistent_winner' | 'price_clustering' | 'bid_suppression';
export type CrowdAnomalyStatus = 'monitoring' | 'flagged' | 'verified';

/** Crowd-sourced anomaly pattern detected from bid outcomes. Stored in crowd_anomalies. */
export interface CrowdAnomaly {
  id?: string;
  agency: string;
  project_type: string;
  pattern: CrowdAnomalyPattern;
  report_count: number;
  first_reported: string;
  last_reported: string;
  status: CrowdAnomalyStatus;
}

/** Aggregated contribution stats. Stored in _meta/contributor_stats. */
export interface ContributorStats {
  outcome_reports: number;
  community_reports: number;
  agencies_improved: number;
  anomalies_verified: number;
  last_updated: string;
}

/** An awarded government contract from the CGD open data API. Stored in cgd_contracts collection. */
export interface AwardedContract {
  projectId: string;
  projectName: string;
  projectType: string;
  agency: string;
  subAgency: string;
  procurementMethod: string;
  procurementMethodGroup: string;
  announceDate: string;
  transactionDate?: string;
  budget: number | null;
  referencePrice: number | null;
  agreedPrice: number | null;
  discountFromReference: number | null;
  fiscalYear: number;
  province: string;
  provinceEn?: string;
  district?: string;
  districtEn?: string;
  subDistrict?: string;
  subDistrictEn?: string;
  gpsPoint?: string;
  projectStatus?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  winnerName: string | null;
  winnerBusinessId: string | null;
  contractNo: string | null;
  contractSignDate: string | null;
  contractEndDate: string | null;
  contractValue: number | null;
  contractStatus: string | null;
  bidders?: string[];
  losers?: string[];
}
