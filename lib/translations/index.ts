import insights from './insights';
import nav from './nav';
import auth from './auth';
import common from './common';
import hero from './hero';
import how from './how';
import val from './val';
import projects from './projects';
import trust from './trust';
import post from './post';
import cards from './cards';
import status from './status';
import categories from './categories';
import footer from './footer';
import procurement from './procurement';
import waitlist from './waitlist';

type NS = { en: Record<string, string>; th: Record<string, string> };

function merge(...namespaces: NS[]): NS {
  return {
    en: Object.assign({}, ...namespaces.map((n) => n.en)),
    th: Object.assign({}, ...namespaces.map((n) => n.th)),
  };
}

export default merge(
  insights,
  nav,
  auth,
  common,
  hero,
  how,
  val,
  projects,
  trust,
  post,
  cards,
  status,
  categories,
  footer,
  procurement,
  waitlist,
);
