// Young Sails — site-wide settings shared by every section.

export const SITE = {
  name: 'Young Sails',
  domain: 'youngsails.org',
  repo: 'https://github.com/kateliev/youngsails',
};

// Languages the site is planned in. Set `ready: true` when a language has
// complete strings; only ready languages appear in the language menu.
// A language that is not ready can still be forced with ?lang=xx for testing.
export const LANGS = [
  { code: 'en', label: 'English', ready: true },
  { code: 'bg', label: 'Български', ready: false },
  { code: 'de', label: 'Deutsch', ready: false },
  { code: 'fr', label: 'Français', ready: false },
  { code: 'ru', label: 'Русский', ready: false },
];
export const DEFAULT_LANG = 'en';

// Second language shown in small type next to part names (a glossary aid).
// English readers see the Bulgarian term; everyone else sees the English term.
export const glossFor = lang => (lang === 'en' ? 'bg' : 'en');

// Sections of the site. `ready: false` sections are planned, not built.
export const SECTIONS = [
  { id: 'optimist', path: 'classes/optimist/', ready: true },
  { id: 'laser', path: 'classes/laser/', ready: true },
  { id: 'flags', path: 'wiki/flags/', ready: false },
  { id: 'rules', path: 'wiki/rules/', ready: false },
  { id: 'courses', path: 'wiki/courses/', ready: false },
  { id: 'federations', path: 'wiki/federations/', ready: false },
  { id: 'game', path: 'game/', ready: false },
];
