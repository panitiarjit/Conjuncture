// Domain types for the Conjuncture procurement marketplace.
// Data fixtures live in lib/mock-data.ts; real API shapes should match these interfaces.

export type TenderStatus = 'open' | 'closing_soon' | 'closed';
export type ProjectStatus = 'open' | 'in_progress' | 'completed';
export type VendorVerified = 'new' | 'verified' | 'verified_pro';
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
}

export interface Project {
  id: string;
  title: string;
  category: ProjectCategory;
  location: string;
  budgetMin: number;
  budgetMax: number;
  bidsReceived: number;
  deadline: string;
  description: string;
  buyerName: string;
  buyerVerified: boolean;
  postedAt: string;
  // Server hint. computeProjectStatus(deadline, status) is the display source of truth.
  status: ProjectStatus;
}

export interface VendorReview {
  id: string;
  author: string;
  rating: number;
  quality: number;
  communication: number;
  timeliness: number;
  priceAccuracy: number;
  comment: string;
  date: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  imageUrl: null;
}

export interface Vendor {
  id: string;
  companyName: string;
  logo: null;
  verified: VendorVerified;
  completedJobs: number;
  rating: number;
  responseRate: number;
  memberSince: string;
  reviews: VendorReview[];
  portfolio: PortfolioItem[];
  categories: string[];
  location: string;
}

export interface Category {
  id: ProjectCategory;
  name: string;
  icon: string;
  count: number;
}
