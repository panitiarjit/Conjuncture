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

export const CATEGORY_KEYS: Record<ProjectCategory, TranslationKey> = {
  construction: 'cat.construction',
  technology: 'cat.technology',
  logistics: 'cat.logistics',
  agriculture: 'cat.agriculture',
  cleaning: 'cat.cleaning',
  consulting: 'cat.consulting',
  renovation: 'cat.renovation',
  medical: 'cat.medical',
  education: 'cat.education',
  food: 'cat.food',
  security: 'cat.security',
  other: 'cat.other',
};
