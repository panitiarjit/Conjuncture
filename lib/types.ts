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
  // Server hint only. Display and filter always use computeTenderStatus(deadline);
  // this field is reserved for admin-set states (e.g. 'cancelled') not expressible by deadline.
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
