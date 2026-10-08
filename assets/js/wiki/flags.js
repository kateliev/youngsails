// Young Sails — race flags library: library grid, filters, detail card, start-sequence trainer and quiz.
//
// Data:  /data/flags/flags.json             race signals of the RRS (language-neutral)
//        /data/flags/classes/<class>.json   class layer: notes, extra entries, hidden ids
// Text:  /i18n/<lang>/flags.json            flags.<id>, classes.<class>.{notes,flags}, ui, trainer, quiz
// A class overlay never changes an RRS meaning; it only adds notes and entries.
import { pickLang, pickGloss, loadStrings, loadRaw, t, applyDom, setLang } from '../core/i18n.js';
import { LANGS, SECTIONS } from '../core/config.js';
import { signalSVG, flagGroup } from './flag-art.js';

const DATA = new URL('../../../data/flags/', import.meta.url);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const PHONE = matchMedia('(max-width: 820px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// Rulebook sound marks: • per sound, — for a long sound, - - - - - for repetitive sounds.
const MARKS = { 1: '●', 2: '● ●', 3: '● ● ●', long: '▬▬', rep: '- - - - -', whistle: '●', none: '' };

export async function startFlags() {
  const lang = pickLang(), gloss = pickGloss(lang);
  document.documentElement.lang = lang;
  const [S, G, base] = await Promise.all([
    loadStrings('flags', lang), gloss ? loadRaw('flags', gloss) : {}, getJSON(new URL('flags.json', DATA)),
  ]);
  const overlays = Object.fromEntries(await Promise.all(base.classes.map(async c => [c, await getJSON(new URL(`classes/${c}.json`, DATA)).catch(() => ({}))])));

  const params = new URLSearchParams(location.search);
  const state = {
    cls: base.classes.includes(params.get('class')) ? params.get('class') : base.classes[0],
    group: 'all', query: '', selected: null, view: 'library',
  };

  /* ---------------- text helpers ---------------- */
  const classText = () => S.classes?.[state.cls] || {};
  const txt = id => ({ ...(S.flags?.[id] || {}), ...(classText().flags?.[id] || {}) });
  const nameOf = id => txt(id).name || id;
  const glossOf = id => { const g = G?.classes?.[state.cls]?.flags?.[id]?.name || G?.flags?.[id]?.name || ''; return g && g !== nameOf(id) ? g : ''; };
  const soundWord = code => t(S, `sounds.${code}`);
  function soundText(e) {
    const x = txt(e.id);
    if (x.sound) return x.sound;
    if (!e.sound) return '';
    if (e.sound.up === 'none' && !e.sound.down) return soundWord('none');
    return ['up', 'down'].filter(k => e.sound[k]).map(k => t(S, `sounds.${k}`, { s: soundWord(e.sound[k]) })).join('. ') + '.';
  }
  const soundMarks = e => (e.sound ? ['up', 'down'].filter(k => e.sound[k] && MARKS[e.sound[k]]).map(k => `${k === 'up' ? '↑' : '↓'} ${MARKS[e.sound[k]]}`).join('   ') : '');
  const artFor = (e, label = '') => signalSVG(e.stack, { label, layout: e.layout || (e.side ? 'side' : 'stack') });

  /* ---------------- class layer ---------------- */
  let entries = [], notes = {}, byId = {};
  function applyClass() {
    const ov = overlays[state.cls] || {}, hide = new Set(ov.hide || []);
    entries = base.signals.filter(s => !hide.has(s.id)).concat(ov.add || []);
    byId = Object.fromEntries(entries.map(e => [e.id, e]));
    notes = Object.fromEntries((ov.notes || []).map(n => [n.for, n]));
  }
  applyClass();

  /* ---------------- page frame ---------------- */
  applyDom(S);
  const title = S.title || '', ai = S.titleAccent ?? -1;
  $('pageTitle').innerHTML = ai >= 0 && ai < title.length ? `${esc(title.slice(0, ai))}<span>${esc(title[ai])}</span>${esc(title.slice(ai + 1))}` : esc(title);
  $('tagline').textContent = S.tagline || '';
  document.title = `${S.pageTitle || title} · Young Sails`;
  const edition = t(S, 'edition', { e: base.editionYears });
  $('edition').textContent = edition;
  $('footEdition').textContent = `${edition} · ${t(S, 'intro.rule')}`;

  const langs = LANGS.filter(l => l.ready || l.code === lang), sel = $('langSelect');
  if (langs.length > 1) {
    sel.innerHTML = langs.map(l => `<option value="${l.code}" ${l.code === lang ? 'selected' : ''}>${l.code.toUpperCase()}</option>`).join('');
    sel.onchange = () => setLang(sel.value);
  } else sel.hidden = true;

  // class toggle (kept in the URL as ?class=…)
  const classSeg = $('classSeg');
  function renderClassSeg() {
    classSeg.innerHTML = base.classes.map(c => `<button data-class="${c}" aria-pressed="${c === state.cls}">${esc(S.classes?.[c]?.name || c)}</button>`).join('');
  }
  renderClassSeg();
  classSeg.addEventListener('click', e => {
    const b = e.target.closest('button[data-class]'); if (!b || b.dataset.class === state.cls) return;
    state.cls = b.dataset.class;
    const u = new URL(location.href); u.searchParams.set('class', state.cls); history.replaceState(null, '', u);
    applyClass(); renderClassSeg();
    if (state.selected && !byId[state.selected]) state.selected = null;
    renderFilters(); renderGrid(); renderCard(); renderIntroInline(); quiz?.reset();
  });

  /* ---------------- library: filters and grid ---------------- */
  const grid = $('grid'), card = $('card'), filterRow = $('filterRow'), search = $('search');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function visible() {
    const q = norm(state.query.trim());
    return entries.filter(e => {
      if (state.group !== 'all' && !e.groups.includes(state.group)) return false;
      if (!q) return true;
      const x = txt(e.id);
      return norm([e.id, x.name, x.means, x.youDo, glossOf(e.id), ...e.groups.map(g => t(S, `groups.${g}`))].join(' ')).includes(q);
    });
  }
  function renderFilters() {
    const used = base.groups.filter(g => entries.some(e => e.groups.includes(g)));
    if (state.group !== 'all' && !used.includes(state.group)) state.group = 'all';
    filterRow.innerHTML = ['all', ...used].map(g =>
      `<button class="tg" data-group="${g}" aria-pressed="${g === state.group}">${esc(g === 'all' ? t(S, 'ui.all') : t(S, `groups.${g}`))}</button>`).join('');
  }
  filterRow.addEventListener('click', e => {
    const b = e.target.closest('button[data-group]'); if (!b) return;
    state.group = b.dataset.group; renderFilters(); renderGrid();
  });
  search.addEventListener('input', () => { state.query = search.value; renderGrid(); });

  function renderGrid() {
    const list = visible();
    $('resultCount').textContent = list.length ? t(S, 'ui.count', { n: list.length }) : t(S, 'ui.noResults');
    grid.innerHTML = list.map(e => {
      const x = txt(e.id);
      return `<button class="tile" data-id="${esc(e.id)}" aria-pressed="${e.id === state.selected}">
        <span class="art-backing">${artFor(e)}</span>
        <span class="tile-name">${esc(x.name || e.id)}</span>
        <span class="tile-text">${esc(x.means)}</span>
        ${e.si ? `<span class="badge-si">${esc(t(S, 'ui.siShort'))}</span>` : ''}
      </button>`;
    }).join('');
  }
  grid.addEventListener('click', e => { const b = e.target.closest('.tile'); if (b) select(b.dataset.id, true); });
  // arrow keys move between tiles
  grid.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const tiles = [...grid.querySelectorAll('.tile')], i = tiles.indexOf(document.activeElement); if (i < 0) return;
    const cols = Math.max(1, Math.round(grid.clientWidth / tiles[0].offsetWidth));
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    const j = Math.min(tiles.length - 1, Math.max(0, i + d)); tiles[j].focus(); e.preventDefault();
  });

  /* ---------------- card ---------------- */
  const spec = rows => `<dl class="spec">${rows.filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  function introHtml(withHeading = true) {
    const I = S.intro || {}, ct = classText();
    return `${withHeading ? `<div class="eyebrow"><span class="chip">${esc(I.chip)}</span></div><h2>${esc(I.heading)}</h2>` : ''}
      <p>${esc(I.text)}</p>
      <dl class="legend">${(I.legend || []).map(([m, w]) => `<dt>${esc(m)}</dt><dd>${esc(w)}</dd>`).join('')}</dl>
      <p>${esc(I.over)}</p>
      <p class="note"><b>${esc(t(S, 'ui.tip'))}:</b> ${esc(I.tip)}</p>
      ${ct.intro ? `<div class="callout"><div class="eyebrow-label">${esc(ct.name)}</div><p>${esc(ct.intro)}</p></div>` : ''}`;
  }
  function renderIntroInline() {
    const d = $('introInline');
    d.querySelector('summary').textContent = S.intro?.heading || '';
    d.querySelector('div').innerHTML = introHtml(false);
  }
  function renderCard() {
    const id = state.selected, e = id && byId[id];
    if (!e) {
      card.innerHTML = `${introHtml()}<p class="note">${esc(t(S, 'intro.hint'))}</p>`;
      setSheet(false); return;
    }
    const x = txt(id), list = visible(), idx = list.findIndex(v => v.id === id), n = notes[id], ct = classText();
    const marks = soundMarks(e);
    const variants = e.variants ? `<p class="eyebrow-label">${esc(t(S, 'ui.variants'))}</p><div class="strip">${e.variants.map((v, i) =>
      `<figure><span class="art-backing">${signalSVG([v], { label: `${i + 1}` })}</span><figcaption>${i + 1}</figcaption></figure>`).join('')}</div>` : '';
    const extras = e.extras ? `<p class="eyebrow-label">${esc(t(S, 'ui.extras'))}</p><div class="strip">${e.extras.map(v =>
      `<figure><span class="art-backing">${signalSVG([v], { label: t(S, `extras.${v}`) })}</span><figcaption>${esc(t(S, `extras.${v}`))}</figcaption></figure>`).join('')}</div>` : '';
    card.innerHTML = `
      <div class="eyebrow"><span class="row"><span class="chip">${esc(t(S, `groups.${e.groups[0]}`))}</span>${e.si ? `<span class="badge-si">${esc(t(S, 'ui.siShort'))}</span>` : ''}</span>
        <span class="count">${idx >= 0 ? `${idx + 1} / ${list.length}` : ''}</span></div>
      <h2 tabindex="-1">${esc(x.name || id)}</h2>${glossOf(id) ? `<div class="gloss" lang="${esc(G?._lang || gloss || '')}">${esc(glossOf(id))}</div>` : ''}
      <div class="art-backing card-art">${artFor(e, x.name || id)}</div>
      ${variants}
      <p><b>${esc(x.means)}</b></p>
      ${spec([
        [t(S, 'ui.youDo'), esc(x.youDo)],
        [t(S, 'ui.sound'), soundText(e) ? `${marks ? `<span class="sound-marks" aria-hidden="true">${esc(marks)}</span><br>` : ''}${esc(soundText(e))}` : ''],
        [t(S, 'ui.rule'), esc(e.rule === 'SI' ? t(S, 'ui.si') : e.rule)],
      ])}
      ${extras}
      ${x.tip ? `<p class="note"><b>${esc(t(S, 'ui.tip'))}:</b> ${esc(x.tip)}</p>` : ''}
      ${linkHtml(e.link)}
      ${n && ct.notes?.[id] ? `<div class="callout"><div class="eyebrow-label">${esc(t(S, 'ui.classNote', { c: ct.name }))}${n.si ? `<span class="badge-si">${esc(t(S, 'ui.si'))}</span>` : ''}</div><p>${esc(ct.notes[id])}</p></div>` : ''}
      <div class="row">
        <button class="btn" id="prev" aria-label="${esc(t(S, 'ui.prevAria'))}">${esc(t(S, 'ui.prev'))}</button>
        <button class="btn" id="next" aria-label="${esc(t(S, 'ui.nextAria'))}">${esc(t(S, 'ui.next'))}</button>
        <button class="btn close" id="closeCard" aria-label="${esc(t(S, 'ui.closeAria'))}">${esc(t(S, 'ui.close'))}</button>
      </div>`;
    $('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
    $('closeCard').onclick = () => select(null);
  }
  // An entry may point to another section of the site; it becomes a link once that section is ready.
  function linkHtml(id) {
    const sec = id && SECTIONS.find(s => s.id === id);
    if (!sec) return '';
    const label = t(S, `ui.links.${id}`);
    return sec.ready ? `<p><a href="../../${sec.path}">${esc(label)} →</a></p>` : `<p class="note">${esc(t(S, 'ui.soon', { name: label }))}</p>`;
  }
  let lastTile = null;
  function setSheet(open) {
    card.classList.toggle('open', open && PHONE.matches);
    document.body.classList.toggle('sheet-open', open && PHONE.matches);
  }
  function step(d) {
    const list = visible(); if (!list.length) return;
    const i = list.findIndex(v => v.id === state.selected);
    select(list[(i + d + list.length) % list.length].id, false);
  }
  function select(id, fromTile) {
    const wasOpen = !!state.selected;
    state.selected = id;
    for (const b of grid.querySelectorAll('.tile')) b.setAttribute('aria-pressed', String(b.dataset.id === id));
    renderCard();
    if (id) {
      setSheet(true);
      const tile = grid.querySelector(`.tile[data-id="${CSS.escape(id)}"]`);
      if (fromTile) lastTile = tile;
      if (PHONE.matches) card.querySelector('h2')?.focus({ preventScroll: true });
      else tile?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
      card.scrollTop = 0;
    } else if (wasOpen && PHONE.matches) lastTile?.focus();
  }
  addEventListener('keydown', e => {
    if (state.view !== 'library' || e.target.matches('input, select, textarea')) return;
    if (e.key === 'Escape' && state.selected) select(null);
    else if (state.selected && !e.target.closest('.tile-grid') && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) step(e.key === 'ArrowRight' ? 1 : -1);
  });
  PHONE.addEventListener?.('change', () => setSheet(!!state.selected));

  renderFilters(); renderGrid(); renderCard(); renderIntroInline();

  /* ---------------- views ---------------- */
  let trainer = null, quiz = null;
  const viewSeg = $('viewSeg');
  function setView(v) {
    if (!['library', 'trainer', 'quiz'].includes(v)) v = 'library';
    state.view = v;
    for (const b of viewSeg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
    $('view-library').hidden = v !== 'library'; $('view-trainer').hidden = v !== 'trainer'; $('view-quiz').hidden = v !== 'quiz';
    if (v !== 'library') setSheet(false); else setSheet(!!state.selected);
    if (v === 'trainer' && !trainer) trainer = createTrainer($('view-trainer'), { S });
    if (v !== 'trainer') trainer?.pause();
    if (v === 'quiz' && !quiz) quiz = createQuiz($('view-quiz'), { S, pool: () => entries, txt, artFor });
    if (location.hash.slice(1) !== v) history.replaceState(null, '', v === 'library' ? location.pathname + location.search : `#${v}`);
  }
  viewSeg.addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) setView(b.dataset.view); });
  addEventListener('hashchange', () => setView(location.hash.slice(1)));
  setView(location.hash.slice(1));

  window.youngsails = { state, entries: () => entries, S, base, overlays, trainer: () => trainer, quiz: () => quiz };
}

/* =====================================================================
   Start-sequence trainer (RRS 26, 29, 30; Race Signals AP)
   ===================================================================== */
const PREPS = { P: 'ics-P', I: 'ics-I', Z: 'ics-Z', U: 'ics-U', black: 'plain-black' };
const SLOT_X = { cls: 62, prep: 142, rec: 222 };   // halyards on the committee boat's yard
const UP_Y = 44, DOWN_Y = 214, FLAG_H = 40;
// course top view: pin end, committee boat end, first mark, and the fleet
const PIN = [70, 196], RC = [290, 196], M1 = [180, 40];
const BOATS = [[96, 222], [128, 214], [160, 226], [196, 216], [230, 224], [262, 214]];
const fmt = s => { const a = Math.abs(Math.round(s)); return `${Math.floor(a / 60)}:${String(a % 60).padStart(2, '0')}`; };

// The timeline for one run, in seconds from pressing Start. Times come from RRS 26
// (warning 5:00, preparatory 4:00, one minute 1:00, start 0:00), 29.2 and the
// AP/First Substitute race signals (next warning 1 minute after removal).
function buildSequence(prep, scen) {
  const ev = [], starts = [];
  const add = (t, o) => ev.push({ t, ...o });
  const seq = w => {
    add(w, { set: { cls: true }, sound: '1', key: 'classUp', phase: 'warning', tick: '5' });
    add(w + 60, { set: { prep: true }, sound: '1', key: 'prepUp', phase: 'prep', tick: '4' });
    add(w + 240, { set: { prep: false }, sound: 'long', key: 'prepDown', phase: 'last', tick: '1' });
    add(w + 300, { set: { cls: false }, sound: '1', key: 'classDown', phase: 'started', tick: '0' });
    starts.push({ warn: w, start: w + 300 });
    return w + 300;
  };
  let w = 10, end;
  if (scen === 'ap') {
    add(3, { set: { rec: 'ics-AP' }, sound: '2', key: 'apUp', phase: 'postponed', tick: 'AP' });
    add(33, { set: { rec: null }, sound: '1', key: 'apDown', phase: 'waiting' });
    w = 93;
  }
  let s = seq(w);
  if (scen === 'x') {
    // RRS 29.1 does not apply when rule 30.3 (U) or 30.4 (black flag) applies.
    if (prep === 'U' || prep === 'black') add(s + 2, { key: 'noX' });
    else { add(s + 1, { set: { rec: 'ics-X' }, sound: '1', key: 'xUp' }); add(s + 40, { set: { rec: null }, key: 'xDown' }); }
    end = s + 48;
  } else if (scen === 'gr') {
    add(s + 2, { set: { rec: 'sub-1' }, sound: '2', key: 'fsUp', phase: 'recall' });
    if (prep === 'black') add(s + 25, { key: 'blackNumbers' });
    add(s + 50, { set: { rec: null }, sound: '1', key: 'fsDown' });
    s = seq(s + 110);
    end = s + 15;
  } else end = s + 15;
  add(end, { key: 'end', phase: 'done' });
  ev.sort((a, b) => a.t - b.t);
  return { ev, starts, end };
}

function createTrainer(root, { S }) {
  const T = (k, v) => t(S, `trainer.${k}`, v);
  const opts = { prep: 'P', scen: 'clean', speed: 1, sound: true };
  let seq, now = 0, running = false, fired = 0, last = 0, raf = 0, phase = 'waiting', audio = null;
  const flags = { cls: false, prep: false, rec: null };

  const segBtns = (name, items, cur) => items.map(([v, label, art]) =>
    `<button data-${name}="${v}" aria-pressed="${v === cur}">${art ? signalSVG([art]) : ''}${esc(label)}</button>`).join('');
  root.innerHTML = `
    <div class="wiki-panel panel" style="margin-bottom:12px"><h2>${esc(T('heading'))}</h2><p>${esc(T('intro'))}</p></div>
    <div class="trainer">
      <div class="tr-col">
        <div class="scenes">
          <figure class="scene panel"><figcaption>${esc(T('committee'))}</figcaption>${boatSVG()}</figure>
          <figure class="scene panel"><figcaption>${esc(T('course'))}</figcaption>${courseSVG()}</figure>
        </div>
        <div class="wiki-panel panel tr-time">
          <h3>${esc(T('timeline'))}</h3>
          <div class="timeline" id="trTimeline"><div class="bar"><div class="fill" id="trFill"></div></div></div>
          <h3 style="margin-top:12px">${esc(T('log'))}</h3>
          <ol class="tr-log" id="trLog"></ol>
        </div>
      </div>
      <div class="tr-col">
        <div class="clock panel"><div class="phase" id="trPhase"></div><div class="time" id="trTime">5:00</div><div class="sub" id="trSub"></div></div>
        <div class="tr-controls panel">
          <div class="row"><button class="btn primary" id="trGo"></button><button class="btn" id="trReset">${esc(T('reset'))}</button>
            <label class="check"><input type="checkbox" id="trSound" checked> ${esc(T('soundOn'))}</label></div>
          <p class="note" style="margin:0">${esc(T('soundHint'))}</p>
          <span class="eyebrow-label">${esc(T('prep'))}</span>
          <div class="seg" role="group" id="trPrep" aria-label="${esc(T('prep'))}">${segBtns('prep', Object.entries(PREPS).map(([k, a]) => [k, t(S, `flags.${k}.name`), a]), opts.prep)}</div>
          <span class="eyebrow-label">${esc(T('scenario'))}</span>
          <div class="seg" role="group" id="trScen" aria-label="${esc(T('scenario'))}">${segBtns('scen', ['clean', 'x', 'gr', 'ap'].map(k => [k, T(`scenarios.${k}`)]), opts.scen)}</div>
          <span class="eyebrow-label">${esc(T('speed'))}</span>
          <div class="seg" role="group" id="trSpeed" aria-label="${esc(T('speed'))}">${segBtns('speed', [1, 2, 5, 10].map(k => [String(k), `${k}×`]), '1')}</div>
        </div>
        <div class="wiki-panel panel tr-rules"><h3>${esc(T('rules.heading'))}</h3><div class="rulebox"><p id="trRule"></p></div></div>
      </div>
    </div>`;
  const q = sel => root.querySelector(sel);

  /* ----- committee boat (side view) ----- */
  function boatSVG() {
    const halyards = Object.values(SLOT_X).map(x => `<line class="tr-halyard" x1="${x - 3}" y1="26" x2="${x - 3}" y2="196"/>`).join('');
    return `<svg viewBox="0 0 360 250" role="img" aria-label="${esc(T('boatAria'))}">
      <rect class="tr-sea" x="0" y="206" width="360" height="44"/>
      <line class="tr-mast" x1="30" y1="200" x2="30" y2="18"/><line class="tr-mast" x1="30" y1="26" x2="300" y2="26" style="stroke-width:3"/>
      ${halyards}
      <clipPath id="trAbove"><rect x="0" y="0" width="360" height="198"/></clipPath>
      <g clip-path="url(#trAbove)">
        <g class="tr-flag" id="trF-cls"></g><g class="tr-flag" id="trF-prep"></g><g class="tr-flag" id="trF-rec"></g>
      </g>
      <line class="tr-mast" x1="322" y1="198" x2="322" y2="104" style="stroke-width:3"/>
      ${flagGroup('plain-orange', 324, 106, 30)}
      <polygon class="tr-ink2" points="8,198 352,198 330,232 26,232"/>
      <rect class="tr-ink" x="120" y="172" width="110" height="26" rx="4"/>
      <text class="tr-text" x="324" y="98" text-anchor="middle" style="font-size:11px">${esc(t(S, 'flags.orange.name'))}</text>
    </svg>`;
  }
  // Each halyard holds one flag <g>; its art is rebuilt only when it changes, and
  // raising or lowering is a CSS transform (instant with reduced motion, see base.css).
  function hoist(slot, art, up) {
    const g = q(`#trF-${slot}`);
    if (art && g.dataset.art !== art) { g.innerHTML = flagGroup(art, 0, 0, FLAG_H); g.dataset.art = art; }
    g.style.transform = `translate(${SLOT_X[slot]}px, ${up ? UP_Y : DOWN_Y}px)`;
  }
  function drawFlags() {
    hoist('cls', 'class', flags.cls);
    hoist('prep', PREPS[opts.prep], flags.prep);
    hoist('rec', flags.rec, !!flags.rec);
  }

  /* ----- course (top view) ----- */
  function courseSVG() {
    const tri = `${PIN.join(',')} ${RC.join(',')} ${M1.join(',')}`;
    return `<svg viewBox="0 0 360 250" role="img" aria-label="${esc(T('courseAria'))}">
      <rect class="tr-sea" x="0" y="0" width="360" height="250" rx="8"/>
      <polygon class="tr-tri" id="trTri" points="${tri}"/>
      <text class="tr-warn" id="trTriText" x="180" y="150" text-anchor="middle">${esc(T('triangle'))}</text>
      <g id="trExt">
        <line class="tr-ext" x1="8" y1="196" x2="64" y2="196"/><line class="tr-ext" x1="296" y1="196" x2="352" y2="196"/>
        <path d="M60 182 C 30 182, 30 214, 60 214" fill="none" class="tr-ext" style="stroke:var(--danger)"/>
        <path d="M300 182 C 330 182, 330 214, 300 214" fill="none" class="tr-ext" style="stroke:var(--danger)"/>
        <text class="tr-warn" x="180" y="244" text-anchor="middle">${esc(T('extensions'))}</text>
      </g>
      <line class="tr-line" x1="${PIN[0]}" y1="${PIN[1]}" x2="${RC[0]}" y2="${RC[1]}"/>
      <circle class="tr-mark" cx="${M1[0]}" cy="${M1[1]}" r="8"/><text class="tr-text" x="${M1[0] + 14}" y="${M1[1] + 5}">${esc(T('mark1'))}</text>
      <circle class="tr-mark" cx="${PIN[0]}" cy="${PIN[1]}" r="6"/><text class="tr-text" x="${PIN[0]}" y="${PIN[1] - 26}" text-anchor="middle">${esc(T('pin'))}</text>
      <path class="tr-ink" d="M${RC[0] - 4} ${RC[1] - 10} h30 l8 10 l-8 10 h-30 z"/>
      ${flagGroup('plain-orange', RC[0] + 6, RC[1] - 34, 14)}
      <g id="trBoats">${BOATS.map((_, i) => `<path class="tr-boat" id="trB${i}" d="M0 -9 L5 6 L-5 6 Z"/>`).join('')}</g>
      <text class="tr-text" x="12" y="22">${esc(T('wind'))} ↓</text>
    </svg>`;
  }
  // Boat positions follow the clock: hovering below the line before the start, sailing up after it.
  // In the recall scenarios some boats are over the line at the start.
  function drawBoats(rel) {
    const over = opts.scen === 'gr' ? [0, 1, 2, 3, 4] : opts.scen === 'x' ? [2] : [];
    const xDown = seq.ev.find(e => e.key === 'xDown' || e.key === 'noX');
    BOATS.forEach(([x, y], i) => {
      let yy = y + (reduceMotion ? 0 : Math.sin(now * .7 + i) * 3);
      const isOver = over.includes(i) && rel > -12 && rel < 1 && phase !== 'recall';
      if (isOver) yy = 182 - i % 2 * 6;
      if (rel >= 0 && phase !== 'recall' && phase !== 'postponed') {
        const back = opts.scen === 'x' && i === 2 && xDown && now < xDown.t;
        yy = back ? 222 : y - Math.min(rel, 60) * 2.4;
      }
      const b = q(`#trB${i}`); b.setAttribute('transform', `translate(${x} ${yy})`);
      b.style.fill = isOver || (opts.scen === 'x' && i === 2 && rel >= 0 && rel < 40) ? 'var(--danger)' : '';
    });
  }

  /* ----- sound ----- */
  function horn(code) {
    if (!opts.sound || !audio || !code || code === 'none') return;
    const pat = { 1: [.35], 2: [.35, .35], 3: [.35, .35, .35], long: [1.4], rep: [.15, .15, .15, .15, .15] }[code]; if (!pat) return;
    let at = audio.currentTime + .02;
    for (const d of pat) {
      const o = audio.createOscillator(), g = audio.createGain(), f = audio.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 330; f.type = 'lowpass'; f.frequency.value = 1400;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(.16, at + .02); g.gain.setValueAtTime(.16, at + d - .04); g.gain.linearRampToValueAtTime(0, at + d);
      o.connect(f).connect(g).connect(audio.destination); o.start(at); o.stop(at + d + .02);
      at += d + (code === 'rep' ? .12 : .25);
    }
  }

  /* ----- state and loop ----- */
  const activeStart = () => [...seq.starts].reverse().find(s => s.warn <= now + 1e-6);
  const eventText = e => T(`events.${e.key}`, { flag: t(S, `flags.${opts.prep}.name`) });
  function clockLabel(at) {
    const a = [...seq.starts].reverse().find(s => s.warn <= at + 1e-6);
    if (!a) return '';
    return at <= a.start ? fmt(a.start - at) : `+${fmt(at - a.start)}`;
  }
  function fire(e) {
    if (e.set) Object.assign(flags, e.set);
    if (e.phase) phase = e.phase;
    horn(e.sound);
    const li = document.createElement('li');
    li.innerHTML = `<time>${esc(clockLabel(e.t))}</time><span class="sound-marks" aria-hidden="true">${esc(e.sound ? MARKS[e.sound] : '')}</span><span>${esc(eventText(e))}</span>`;
    const log = q('#trLog'); log.appendChild(li); log.scrollTop = log.scrollHeight;
  }
  function render() {
    const a = activeStart(), rel = a ? now - a.start : -Infinity;
    const last = a && rel > -60 && rel < 0 && phase !== 'recall';
    const time = q('#trTime');
    time.textContent = phase === 'postponed' || phase === 'recall' || !a ? (phase === 'waiting' && !now ? '5:00' : '–:––') : rel <= 0 ? fmt(-rel) : `+${fmt(rel)}`;
    time.classList.toggle('last', !!last);
    q('#trPhase').textContent = last ? T('lastMinute') : T(`phases.${phase}`);
    const nx = seq.ev[fired];
    q('#trSub').textContent = !running && now === 0 ? T('ready') : nx ? T('next', { what: eventText(nx), s: Math.max(0, Math.ceil(nx.t - now)) }) : T('nothingNext');
    q('#trFill').style.width = `${Math.min(100, now / seq.end * 100)}%`;
    const triRule = ['Z', 'U', 'black'].includes(opts.prep);
    q('#trTri').style.display = q('#trTriText').style.display = triRule ? '' : 'none';
    q('#trTri').classList.toggle('hot', !!last && triRule);
    q('#trExt').style.display = opts.prep === 'I' ? '' : 'none';
    drawFlags(); drawBoats(rel);
    const go = q('#trGo');
    go.textContent = running ? T('pause') : now >= seq.end ? T('restart') : now > 0 ? T('resume') : T('start');
  }
  function renderTimeline() {
    const el = q('#trTimeline');
    el.querySelectorAll('.tick').forEach(n => n.remove());
    for (const e of seq.ev.filter(e => e.set || e.key === 'end')) {
      const d = document.createElement('div'); d.className = 'tick' + (e.tick ? ' major' : '');
      d.style.left = `${e.t / seq.end * 100}%`;
      d.innerHTML = `<i></i><b>${esc(e.tick || '')}</b>`; d.title = eventText(e);
      el.appendChild(d);
    }
  }
  function loop(ts) {
    const dt = Math.min(.25, (ts - last) / 1000); last = ts;
    if (running) {
      now = Math.min(seq.end, now + dt * opts.speed);
      while (fired < seq.ev.length && seq.ev[fired].t <= now) fire(seq.ev[fired++]);
      if (now >= seq.end) running = false;
    }
    render();
    raf = running ? requestAnimationFrame(loop) : 0;
  }
  function play() {
    if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; } }
    audio?.resume?.();
    if (now >= seq.end) reset();
    running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }
  function pause() { running = false; render(); }
  function reset() {
    running = false; now = 0; fired = 0; phase = 'waiting';
    Object.assign(flags, { cls: false, prep: false, rec: null });
    seq = buildSequence(opts.prep, opts.scen);
    q('#trLog').innerHTML = ''; renderTimeline();
    q('#trRule').textContent = T(`rules.${opts.prep}`);
    render();
  }
  const pick = (id, key, apply) => q(id).addEventListener('click', e => {
    const b = e.target.closest(`button[data-${key}]`); if (!b) return;
    q(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    apply(b.dataset[key]);
  });
  pick('#trPrep', 'prep', v => { opts.prep = v; reset(); });
  pick('#trScen', 'scen', v => { opts.scen = v; reset(); });
  pick('#trSpeed', 'speed', v => { opts.speed = +v; });
  q('#trGo').onclick = () => (running ? pause() : play());
  q('#trReset').onclick = reset;
  q('#trSound').onchange = e => { opts.sound = e.target.checked; };
  reset();
  return { play, pause, reset, opts, get now() { return now; }, set now(v) { now = v; while (fired < seq.ev.length && seq.ev[fired].t <= now) fire(seq.ev[fired++]); render(); }, get seq() { return seq; } };
}

/* =====================================================================
   Quiz: "Which flag means…?" and "What does this flag mean?"
   ===================================================================== */
function createQuiz(root, { S, pool, txt, artFor }) {
  const Q = (k, v) => t(S, `quiz.${k}`, v);
  const N = 10;
  let qs = [], i = 0, score = 0, answered = false;
  const shuffle = a => { a = [...a]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };

  function welcome() {
    root.innerHTML = `<div class="quiz wiki-panel panel"><h2>${esc(Q('heading'))}</h2><p>${esc(Q('intro'))}</p>
      <div class="row"><button class="btn primary" id="qzStart">${esc(Q('start'))}</button></div></div>`;
    root.querySelector('#qzStart').onclick = start;
  }
  function start() {
    // Event-specific entries are left out: the quiz asks only about RRS race signals.
    const list = pool().filter(e => !e.si && txt(e.id).means);
    qs = shuffle(list).slice(0, N).map((e, k) => {
      const others = shuffle(list.filter(o => o.id !== e.id && txt(o.id).means !== txt(e.id).means)).slice(0, 3);
      return { e, mode: k % 2 ? 'flag' : 'meaning', options: shuffle([e, ...others]) };
    });
    i = 0; score = 0; show();
  }
  function show() {
    answered = false;
    const { e, mode, options } = qs[i], x = txt(e.id);
    const head = `<div class="eyebrow" style="display:flex;justify-content:space-between;gap:8px"><span class="chip">${esc(mode === 'meaning' ? Q('modeMeaning') : Q('modeFlag'))}</span>
      <span class="note">${esc(Q('progress', { i: i + 1, n: qs.length }))} · ${esc(Q('score', { s: score }))}</span></div>`;
    const prompt = mode === 'meaning'
      ? `<h2 style="font-size:26px">${esc(Q('qMeaning', { means: x.means }))}</h2>`
      : `<h2 style="font-size:26px">${esc(Q('qFlag'))}</h2><div class="art-backing q-flag">${artFor(e, '')}</div>`;
    const answers = options.map(o => mode === 'meaning'
      ? `<button class="answer" data-id="${esc(o.id)}" aria-label="${esc(txt(o.id).name)}"><span class="art-backing">${artFor(o)}</span></button>`
      : `<button class="answer" data-id="${esc(o.id)}">${esc(txt(o.id).means)}</button>`).join('');
    root.innerHTML = `<div class="quiz wiki-panel panel">${head}${prompt}
      <div class="answers ${mode === 'meaning' ? 'flags-only' : ''}" id="qzAnswers">${answers}</div>
      <p class="feedback" id="qzFeedback" aria-live="polite"></p>
      <div class="row"><button class="btn primary" id="qzNext" hidden>${esc(Q('next'))}</button></div></div>`;
    root.querySelector('#qzAnswers').addEventListener('click', ev => {
      const b = ev.target.closest('.answer'); if (!b || answered) return;
      answered = true;
      const ok = b.dataset.id === e.id; if (ok) score++;
      root.querySelectorAll('.answer').forEach(a => { a.disabled = true; if (a.dataset.id === e.id) a.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const fb = root.querySelector('#qzFeedback');
      fb.textContent = ok ? Q('right') : Q('wrong', { name: x.name }); fb.className = `feedback ${ok ? 'ok' : 'no'}`;
      const nx = root.querySelector('#qzNext'); nx.hidden = false; nx.focus();
    });
    root.querySelector('#qzNext').onclick = () => { if (++i < qs.length) show(); else result(); };
    root.querySelector('.answer')?.focus({ preventScroll: true });
  }
  function result() {
    const n = qs.length, k = score / n;
    root.innerHTML = `<div class="quiz wiki-panel panel"><h2>${esc(Q('result', { s: score, n }))}</h2>
      <p>${esc(k >= .9 ? Q('great') : k >= .6 ? Q('good') : Q('keepGoing'))}</p>
      <div class="row"><button class="btn primary" id="qzAgain">${esc(Q('again'))}</button></div></div>`;
    root.querySelector('#qzAgain').onclick = start;
    root.querySelector('#qzAgain').focus();
  }
  welcome();
  return { reset: welcome, start };
}
