import nav from './translations/nav';
import auth from './translations/auth';
import common from './translations/common';
import hero from './translations/hero';
import how from './translations/how';
import val from './translations/val';
import tenders from './translations/tenders';
import projects from './translations/projects';
import trust from './translations/trust';
import post from './translations/post';
import cards from './translations/cards';
import status from './translations/status';
import categories from './translations/categories';
import footer from './translations/footer';
import procurement from './translations/procurement';
import waitlist from './translations/waitlist';
import type { ProjectCategory } from './types';

export type TranslationKey =
  | keyof typeof nav.en
  | keyof typeof auth.en
  | keyof typeof common.en
  | keyof typeof hero.en
  | keyof typeof how.en
  | keyof typeof val.en
  | keyof typeof tenders.en
  | keyof typeof projects.en
  | keyof typeof trust.en
  | keyof typeof post.en
  | keyof typeof cards.en
  | keyof typeof status.en
  | keyof typeof categories.en
  | keyof typeof footer.en
  | keyof typeof procurement.en
  | keyof typeof waitlist.en;

export const KEYS = {
  NAV: {
    TENDERS: 'nav.tenders',
    PROJECTS: 'nav.projects',
    POST: 'nav.post',
  },
  AUTH: {
    SIGN_IN: 'auth.signIn',
    GET_STARTED: 'auth.getStarted',
    BUYER: 'auth.buyer',
    VENDOR: 'auth.vendor',
    DASHBOARD: 'auth.dashboard',
    SIGN_OUT: 'auth.signOut',
  },
  COMMON: {
    HOME: 'common.home',
    BACK: 'common.back',
    NEXT: 'common.next',
    CLEAR_FILTERS: 'common.clearFilters',
    SORT_BY: 'common.sortBy',
    CATEGORY: 'common.category',
    STATUS: 'common.status',
    BUDGET_RANGE: 'common.budgetRange',
    MIN: 'common.min',
    MAX: 'common.max',
    ALL: 'common.all',
    OPEN: 'common.open',
    LOCATION: 'common.location',
    SORT_DEADLINE: 'common.sort.deadline',
    SORT_BUDGET: 'common.sort.budget',
    SORT_RECENT: 'common.sort.recent',
    NO_RESULTS_DESC: 'common.noResults.desc',
  },
  CARD: {
    BUDGET: 'card.budget',
    DEADLINE: 'card.deadline',
    REGION: 'card.region',
    VIEW_DETAILS: 'card.viewDetails',
    APPLY: 'card.apply',
    VIEW_BRIEF: 'card.viewBrief',
    SUBMIT_BID: 'card.submitBid',
    BID: 'card.bid',
    BIDS: 'card.bids',
    DEADLINE_TODAY: 'card.deadlineToday',
    D_LEFT: 'card.dLeft',
  },
  STATUS: {
    OPEN: 'status.open',
    CLOSING_SOON: 'status.closingSoon',
    CLOSED: 'status.closed',
    IN_PROGRESS: 'status.inProgress',
    COMPLETED: 'status.completed',
    ESCROW_HELD: 'status.escrowHeld',
    ESCROW_RELEASED: 'status.escrowReleased',
  },
  CAT: {
    CONSTRUCTION: 'cat.construction',
    TECHNOLOGY: 'cat.technology',
    LOGISTICS: 'cat.logistics',
    AGRICULTURE: 'cat.agriculture',
    CLEANING: 'cat.cleaning',
    CONSULTING: 'cat.consulting',
    RENOVATION: 'cat.renovation',
    OTHER: 'cat.other',
  },
  PM: {
    SPECIFIC_SIMPLE: 'pm.specific_simple',
    SPECIFIC_COMPARE: 'pm.specific_compare',
    E_BIDDING: 'pm.e_bidding',
    METHOD: 'pm.method',
  },
  TP: {
    TITLE: 'tp.title',
    DESC: 'tp.desc',
    BANNER: 'tp.banner',
    SEARCH: 'tp.search',
    REGION: 'tp.region',
    CLOSING_SOON: 'tp.closingSoon',
    SHOWING: 'tp.showing',
    TENDER: 'tp.tender',
    TENDERS: 'tp.tenders',
    NO_RESULTS: 'tp.noResults',
    ALL_REGIONS: 'tp.allRegions',
  },
  PP: {
    TITLE: 'pp.title',
    DESC: 'pp.desc',
    SEARCH: 'pp.search',
    IN_PROGRESS: 'pp.inProgress',
    SHOWING: 'pp.showing',
    PROJECT: 'pp.project',
    PROJECTS: 'pp.projects',
    NO_RESULTS: 'pp.noResults',
  },
} as const;

export const CATEGORY_KEYS: Record<ProjectCategory, TranslationKey> = {
  construction: 'cat.construction',
  technology: 'cat.technology',
  logistics: 'cat.logistics',
  agriculture: 'cat.agriculture',
  cleaning: 'cat.cleaning',
  consulting: 'cat.consulting',
  renovation: 'cat.renovation',
  other: 'cat.other',
};
