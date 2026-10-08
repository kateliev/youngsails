// Young Sails — translations.
// Strings live in /i18n/<lang>/<namespace>.json. Every lookup falls back to
// English, so a half-translated language still shows a complete page.

import { LANGS, DEFAULT_LANG, glossFor } from './config.js';

const ROOT = new URL('../../../i18n/', import.meta.url);
const STORE_KEY = 'ys.lang';
const codes = LANGS.map(l => l.code);

export function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q && codes.includes(q)) { save(q); return q; }
  const saved = load();
  if (saved && LANGS.find(l => l.code === saved && l.ready)) return saved;
  for (const n of navigator.languages || [navigator.language]) {
    const c = (n || '').slice(0, 2).toLowerCase();
    if (LANGS.find(l => l.code === c && l.ready)) return c;
  }
  return DEFAULT_LANG;
}
export function pickGloss(lang) {
  const q = new URLSearchParams(location.search).get('gloss');
  if (q === 'none') return null;
  return q && codes.includes(q) ? q : glossFor(lang);
}
export function setLang(code) {
  save(code);
  const u = new URL(location.href); u.searchParams.set('lang', code); location.href = u.toString();
}

async function fetchJSON(lang, ns) {
  try {
    const r = await fetch(new URL(`${lang}/${ns}.json`, ROOT));
    return r.ok ? await r.json() : {};
  } catch { return {}; }
}
function merge(base, over) {
  if (Array.isArray(over)) return over;
  if (!over || typeof over !== 'object') return over === undefined ? base : over;
  const out = { ...(base || {}) };
  for (const k of Object.keys(over)) if (!k.startsWith('_')) out[k] = merge(out[k], over[k]);
  return out;
}

// Load one namespace for `lang`, filled in with English where missing.
export async function loadStrings(ns, lang) {
  const en = await fetchJSON(DEFAULT_LANG, ns);
  return lang === DEFAULT_LANG ? en : merge(en, await fetchJSON(lang, ns));
}
// Load only what a language really has (no fallback), e.g. for glossary names.
export async function loadRaw(ns, lang) { return lang ? fetchJSON(lang, ns) : {}; }

// t(dict, 'ui.parts', {n: 4}) → string with {n} filled in; returns the key if missing.
export function t(dict, path, vars) {
  let v = path.split('.').reduce((o, k) => (o == null ? o : o[k]), dict);
  if (typeof v !== 'string') return v ?? path;
  if (vars) v = v.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return v;
}
// Fill elements marked data-i18n="key" (text) or data-i18n-attr="attr:key;attr2:key2".
export function applyDom(dict, root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(dict, el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of el.dataset.i18nAttr.split(';')) { const [a, k] = pair.split(':'); el.setAttribute(a.trim(), t(dict, k.trim())); }
  });
}

function save(c) { try { localStorage.setItem(STORE_KEY, c); } catch { /* storage blocked */ } }
function load() { try { return localStorage.getItem(STORE_KEY); } catch { return null; } }
