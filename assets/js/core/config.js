// Young Sails — site-wide settings shared by every section.

export const SITE = {
  name: 'Young Sails',
  domain: 'youngsails.org',
  repo: 'https://github.com/kateliev/youngsails',
  owner: 'Vassil Kateliev',
  ownerUrl: 'https://github.com/kateliev',
  since: 2026,   // first year of the copyright line; later years show as 2026–YYYY
  // E-mail kept in two pieces so the address never appears whole in the HTML or the
  // repository; sitenav.js joins it in the browser and builds the mailto link only on use.
  contact: ['vassil', 'kateliev.com'],
};

// Languages the site is planned in.
//   ready:   complete strings; picked automatically from the browser language.
//   partial: some strings (missing ones fall back to English); selectable in the menu.
//   neither: listed in the menu as "soon" and disabled. ?lang=xx still forces it for testing.
export const LANGS = [
  { code: 'en', label: 'English', ready: true },
  { code: 'bg', label: 'Български', ready: false, partial: true },
  { code: 'de', label: 'Deutsch', ready: false },
  { code: 'fr', label: 'Français', ready: false },
  { code: 'ru', label: 'Русский', ready: false },
];
export const DEFAULT_LANG = 'en';

// Second language shown in small type next to part names (a glossary aid).
// English readers see the Bulgarian term; everyone else sees the English term.
export const glossFor = lang => (lang === 'en' ? 'bg' : 'en');

// Sections of the site. `ready: false` sections are planned, not built.
// `tab: true` puts a ready section in the site navigation (order = tab order);
// `flagsClass` is the class the flags page opens with when you come from that section.
export const SECTIONS = [
  { id: 'optimist', path: 'classes/optimist/', ready: true, tab: true, flagsClass: 'optimist' },
  { id: 'laser', path: 'classes/laser/', ready: true, tab: true, flagsClass: 'ilca' },
  { id: 'flags', path: 'wiki/flags/', ready: true, tab: true },
  { id: 'rules', path: 'wiki/rules/', ready: false },
  { id: 'courses', path: 'wiki/courses/', ready: false },
  { id: 'federations', path: 'wiki/federations/', ready: false },
  { id: 'game', path: 'game/', ready: false },
];
