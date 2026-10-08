// Young Sails — site navigation: tabs for the ready sections + language menu.
// Every page has <nav id="siteNav" class="site-nav panel"></nav> and calls
//   mountSiteNav({ current: '<section id>' })
// Tabs come from SECTIONS (config.js, `tab: true`), labels from common.json → nav.<id>.
import { SECTIONS, LANGS, DEFAULT_LANG, SITE } from './config.js';
import { pickLang, loadStrings, setLang, t } from './i18n.js';

const ROOT = new URL('../../../', import.meta.url);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GLOBE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg>';

export async function mountSiteNav({ current }) {
  mountSiteFoot();
  const el = document.getElementById('siteNav');
  if (!el) return;
  const lang = pickLang();
  const S = await loadStrings('common', lang);
  const here = SECTIONS.find(s => s.id === current);

  const href = s => {
    const u = new URL(s.path, ROOT);
    if (lang !== DEFAULT_LANG) u.searchParams.set('lang', lang);
    if (s.id === 'flags' && here?.flagsClass) u.searchParams.set('class', here.flagsClass);   // open the flags of the boat you came from
    return u.pathname + u.search;
  };
  const tabs = SECTIONS.filter(s => s.ready && s.tab).map(s => s.id === current
    ? `<a class="site-tab" aria-current="page" href="${href(s)}">${esc(t(S, `nav.${s.id}`))}</a>`
    : `<a class="site-tab" href="${href(s)}">${esc(t(S, `nav.${s.id}`))}</a>`).join('');

  const options = LANGS.map(l => {
    const usable = l.ready || l.partial || l.code === lang;
    const note = l.ready ? '' : l.partial ? ` (${t(S, 'nav.partial')})` : ` (${t(S, 'nav.soon')})`;
    return `<option value="${l.code}" lang="${l.code}" ${l.code === lang ? 'selected' : ''} ${usable ? '' : 'disabled'}>${l.code.toUpperCase()} · ${esc(l.label)}${esc(note)}</option>`;
  }).join('');

  el.setAttribute('aria-label', t(S, 'nav.aria'));
  el.innerHTML = `
    <a class="site-mark" href="${new URL('./', ROOT).pathname}${lang !== DEFAULT_LANG ? `?lang=${lang}` : ''}">Young <b>Sails</b></a>
    <div class="site-tabs">${tabs}</div>
    <label class="site-lang" title="${esc(t(S, 'ui.language'))}">${GLOBE}
      <select aria-label="${esc(t(S, 'ui.language'))}">${options}</select>
      <span class="site-lang-code" aria-hidden="true">${lang.toUpperCase()}</span>
    </label>`;
  el.querySelector('select').addEventListener('change', e => setLang(e.target.value));
}

// Site footer: owner (GitHub profile), copyright years, source repository, e-mail.
// Any page with <footer id="siteFoot" class="site-foot"></footer> gets it.
export function mountSiteFoot() {
  const el = document.getElementById('siteFoot');
  if (!el) return;
  const now = new Date().getFullYear(), years = now > SITE.since ? `${SITE.since}–${now}` : `${SITE.since}`;
  el.innerHTML = `<a href="${SITE.ownerUrl}" rel="author">${esc(SITE.owner)}</a> © ${years}`
    + `<span aria-hidden="true">·</span><a href="${SITE.repo}">GitHub</a>`
    + `<span aria-hidden="true">·</span><a class="site-foot-mail" href="#"></a>`;
  // the address is joined only here, and the mailto link only when the link is used
  const mail = el.querySelector('.site-foot-mail'), addr = () => SITE.contact.join('@');
  mail.textContent = addr();
  const arm = () => { mail.href = 'mailto:' + addr(); };
  for (const ev of ['pointerdown', 'focus', 'keydown']) mail.addEventListener(ev, arm, { once: true });
}
