// Young Sails — race courses: library, detail card, course player, course-board decoder and quiz.
//
// Data:  /data/courses/courses.json             course definitions (language-neutral, wind-relative)
//        /data/courses/classes/<class>.json     class layer: typical courses, notes, extra courses, hidden ids
// Text:  /i18n/<lang>/courses.json              courses.<id>, classes.<class>, ui, route, legs, teach, player, board, quiz, designations
// Leg words reuse common.json → pointsOfSail and trim (the explorers' words).
import { pickLang, pickGloss, loadStrings, loadRaw, t, applyDom } from '../core/i18n.js';
import { SECTIONS, DEFAULT_LANG } from '../core/config.js';
import { syncNavClass } from '../core/sitenav.js';
import { courseSVG, buildTrack, stateAt, resolveStops, beatsInfo, fullProjection, trackPath, boomFor, sameLine } from './course-art.js';

const DATA = new URL('../../../data/courses/', import.meta.url);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = id => document.getElementById(id);
const PHONE = matchMedia('(max-width: 820px)');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const shuffle = a => { a = [...a]; for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };
const pickOne = a => a[Math.floor(Math.random() * a.length)];

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.json();
}

// Flags page cards that the teaching texts point to.
const TEACH_LINKS = { lines: ['orange', 'blue'], changes: ['C', 'M', 'S'] };
const TEACH_ORDER = ['si', 'lines', 'sides', 'gates', 'legs', 'signals', 'changes', 'rules'];

export async function startCourses() {
  const lang = pickLang(), gloss = pickGloss(lang);
  document.documentElement.lang = lang;
  const [S, C, G, base] = await Promise.all([
    loadStrings('courses', lang), loadStrings('common', lang), gloss ? loadRaw('courses', gloss) : {}, getJSON(new URL('courses.json', DATA)),
  ]);
  const overlays = Object.fromEntries(await Promise.all(base.classes.map(async c => [c, await getJSON(new URL(`classes/${c}.json`, DATA)).catch(() => ({}))])));

  const params = new URLSearchParams(location.search);
  const state = {
    cls: base.classes.includes(params.get('class')) ? params.get('class') : base.classes[0],
    family: 'all', selected: null, view: 'library', beats: {},
  };

  /* ---------------- text helpers ---------------- */
  const classText = () => S.classes?.[state.cls] || {};
  const txt = id => ({ ...(S.courses?.[id] || {}), ...(classText().courses?.[id] || {}) });
  const nameOf = c => txt(c.id).name || c.id;
  const glossOf = c => { const g = G?.classes?.[state.cls]?.courses?.[c.id]?.name || G?.courses?.[c.id]?.name || ''; return g && g !== nameOf(c) ? g : ''; };
  const beatsFor = c => { const b = beatsInfo(c); return b.fixed ? b.def : Math.min(b.max, Math.max(b.min, state.beats[c.id] ?? b.def)); };
  const codeOf = (c, n = beatsFor(c)) => (beatsInfo(c).fixed ? (c.code === 'IOD' ? 'IOD' : `${c.code}${n}`) : `${c.code}${n}`);
  const codesOf = c => { const b = beatsInfo(c); const out = []; for (let n = b.min; n <= b.max; n++) out.push(codeOf(c, n)); return out; };
  const flagsHref = id => {
    const u = new URL('../flags/', location.href);
    if (id) u.searchParams.set('flag', id);
    u.searchParams.set('class', state.cls);
    if (lang !== DEFAULT_LANG) u.searchParams.set('lang', lang);
    return u.pathname + u.search;
  };
  const artT = (c, extra = {}) => ({
    wind: t(S, 'art.wind'), start: t(S, 'route.start'), finish: t(S, 'route.finish'), startFinish: t(S, 'art.startFinish'),
    rc: t(S, 'art.rc'), aria: t(S, 'art.aria', { name: nameOf(c) }), ...extra,
  });
  const stopName = s => {
    if (s.type === 'start') return t(S, 'route.start');
    if (s.type === 'finish') return t(S, 'route.finish');
    if (s.type === 'gate') return t(S, 'route.gate', { g: s.gateIds.join('/') });
    return t(S, 'route.mark', { m: s.id });
  };
  const sideWord = side => t(S, side === 'port' ? 'route.port' : 'route.starboard');
  function stopDetail(c, s) {
    if (s.type === 'start') return t(S, 'route.startHow');
    if (s.type === 'finish') return txt(c.id).finish || t(S, 'route.finishHow');
    if (s.type === 'gate') return t(S, 'route.gateHow');
    const m = c.marks[s.id];
    let d = t(S, 'route.leave', { side: sideWord(s.side) });
    if (m.gate) d += ` ${t(S, 'route.gateOne', { other: Object.keys(c.marks).find(k => k !== s.id && c.marks[k].gate === m.gate) })}`;
    if (m.offset) d += ` ${t(S, 'route.offsetHow')}`;
    return d;
  }
  const routeHtml = (c, stops, cls = '') => `<ol class="route ${cls}">${stops.map((s, i) =>
    `<li data-stop="${i}"><b>${esc(stopName(s))}</b><span>${esc(stopDetail(c, s))}</span></li>`).join('')}</ol>`;
  const routeLine = stops => stops.map(s => (s.type === 'gate' ? s.gateIds.join('/') : s.type === 'mark' ? s.id : stopName(s))).join(' – ');
  const legWord = f => t(S, `legs.${f}`);

  /* ---------------- class layer ---------------- */
  let entries = [], notes = {}, byId = {}, typical = new Set();
  function applyClass() {
    const ov = overlays[state.cls] || {}, hide = new Set(ov.hide || []);
    entries = base.courses.filter(c => !hide.has(c.id)).concat(ov.add || []);
    typical = new Set(ov.typical || []);
    const rank = id => { const k = (ov.typical || []).indexOf(id); return k < 0 ? 99 : k; };
    entries.sort((a, b) => rank(a.id) - rank(b.id));   // typical courses first, in the overlay's order
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
  $('edition').textContent = t(S, 'ui.siBadge');
  $('footEdition').textContent = t(S, 'ui.footer', { e: base.edition });

  const classSeg = $('classSeg');
  function renderClassSeg() {
    classSeg.innerHTML = base.classes.map(c => `<button data-class="${c}" aria-pressed="${c === state.cls}">${esc(S.classes?.[c]?.name || c)}</button>`).join('');
  }
  renderClassSeg();
  classSeg.addEventListener('click', e => {
    const b = e.target.closest('button[data-class]'); if (!b || b.dataset.class === state.cls) return;
    state.cls = b.dataset.class;
    const u = new URL(location.href); u.searchParams.set('class', state.cls); history.replaceState(null, '', u);
    syncNavClass(state.cls);
    applyClass(); renderClassSeg();
    if (state.selected && !byId[state.selected]) state.selected = null;
    renderFilters(); renderGrid(); renderCard(); renderIntroInline();
    player?.classChanged(); board?.classChanged(); quiz?.reset();
  });

  /* ---------------- library ---------------- */
  const grid = $('grid'), card = $('card'), filterRow = $('filterRow');
  const visible = () => entries.filter(c => state.family === 'all' || (state.family === 'typical' ? typical.has(c.id) : c.family === state.family));
  function renderFilters() {
    const fams = base.families.filter(f => entries.some(c => c.family === f));
    filterRow.innerHTML = ['all', 'typical', ...fams].map(g =>
      `<button class="tg" data-family="${g}" aria-pressed="${g === state.family}">${esc(g === 'all' ? t(S, 'ui.all') : g === 'typical' ? t(S, 'ui.typicalFilter', { c: classText().name }) : t(S, `families.${g}`))}</button>`).join('');
  }
  filterRow.addEventListener('click', e => {
    const b = e.target.closest('button[data-family]'); if (!b) return;
    state.family = b.dataset.family; renderFilters(); renderGrid();
  });
  function renderGrid() {
    const list = visible();
    $('resultCount').textContent = t(S, 'ui.count', { n: list.length });
    grid.innerHTML = list.map(c => `<button class="tile course-tile" data-id="${esc(c.id)}" aria-pressed="${c.id === state.selected}">
        <span class="course-art">${courseSVG(c, { mode: 'thumb', beats: beatsFor(c) })}</span>
        <span class="tile-codes">${codesOf(c).map(k => `<span class="code">${esc(k)}</span>`).join('')}</span>
        <span class="tile-name">${esc(nameOf(c))}</span>
        <span class="tile-text">${esc(txt(c.id).summary)}</span>
        ${typical.has(c.id) ? `<span class="badge-si">${esc(t(S, 'ui.typical', { c: classText().name }))}</span>` : ''}
      </button>`).join('');
  }
  grid.addEventListener('click', e => { const b = e.target.closest('.tile'); if (b) select(b.dataset.id, true); });
  grid.addEventListener('keydown', e => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const tiles = [...grid.querySelectorAll('.tile')], i = tiles.indexOf(document.activeElement); if (i < 0) return;
    const cols = Math.max(1, Math.round(grid.clientWidth / tiles[0].offsetWidth));
    const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    tiles[Math.min(tiles.length - 1, Math.max(0, i + d))].focus(); e.preventDefault();
  });

  /* ---------------- teaching texts (intro card) ---------------- */
  function teachHtml(open = null) {
    const T = S.teach || {};
    return TEACH_ORDER.filter(k => T[k]).map(k => {
      const x = T[k];
      const links = (TEACH_LINKS[k] || []).map(id => `<a href="${esc(flagsHref(id))}">${esc(t(S, `teach.flagNames.${id}`))} →</a>`).join(' ');
      const soon = k === 'rules' ? `<p class="note">${esc(t(S, 'ui.soon', { name: t(S, 'ui.links.rules') }))}</p>` : '';
      return `<details class="teach"${open === k ? ' open' : ''}><summary>${esc(x.title)}</summary>
        <p>${esc(x.text)}</p>${x.rule ? `<p class="note">${esc(x.rule)}</p>` : ''}${links ? `<p class="links">${links}</p>` : ''}${soon}</details>`;
    }).join('');
  }
  function introHtml(withHeading = true) {
    const I = S.intro || {}, ct = classText();
    return `${withHeading ? `<div class="eyebrow"><span class="chip">${esc(I.chip)}</span></div><h2>${esc(I.heading)}</h2>` : ''}
      <p>${esc(I.text)}</p>
      <div class="callout si-callout"><div class="eyebrow-label"><span class="badge-si">${esc(t(S, 'ui.siBadge'))}</span></div><p>${esc(I.si)}</p></div>
      ${teachHtml()}
      ${ct.intro ? `<div class="callout"><div class="eyebrow-label">${esc(ct.name)}</div><p>${esc(ct.intro)}</p></div>` : ''}`;
  }
  function renderIntroInline() {
    const d = $('introInline');
    d.querySelector('summary').textContent = S.intro?.heading || '';
    d.querySelector('div').innerHTML = introHtml(false);
  }

  /* ---------------- card ---------------- */
  const spec = rows => `<dl class="spec">${rows.filter(r => r[1]).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
  function beatsSeg(c, id) {
    const b = beatsInfo(c); if (b.fixed) return '';
    const cur = beatsFor(c), opts = [];
    for (let n = b.min; n <= b.max; n++) opts.push(`<button data-beats="${n}" aria-pressed="${n === cur}">${esc(codeOf(c, n))}</button>`);
    return `<div class="opt beats-opt"><span class="eyebrow-label">${esc(t(S, 'ui.board'))}</span><div class="seg" role="group" id="${id}" aria-label="${esc(t(S, 'ui.beatsAria'))}">${opts.join('')}</div></div>`;
  }
  function renderCard() {
    const id = state.selected, c = id && byId[id];
    if (!c) { card.innerHTML = `${introHtml()}<p class="note">${esc(t(S, 'intro.hint'))}</p>`; setSheet(false); return; }
    const x = txt(id), list = visible(), idx = list.findIndex(v => v.id === id), n = notes[id], ct = classText();
    const beats = beatsFor(c), stops = resolveStops(c, beats), track = buildTrack(c, { beats });
    const nBeats = track.legs.filter(l => l.family === 'beat').length;
    card.innerHTML = `
      <div class="eyebrow"><span class="row"><span class="chip">${esc(t(S, `families.${c.family}`))}</span>${typical.has(id) ? `<span class="badge-si">${esc(t(S, 'ui.typical', { c: ct.name }))}</span>` : ''}</span>
        <span class="count">${idx >= 0 ? `${idx + 1} / ${list.length}` : ''}</span></div>
      <h2 tabindex="-1">${esc(x.name || id)}</h2>${glossOf(c) ? `<div class="gloss" lang="${esc(G?._lang || gloss || '')}">${esc(glossOf(c))}</div>` : ''}
      ${beatsSeg(c, 'cardBeats')}
      <div class="course-art card-course">${courseSVG(c, { beats, T: artT(c) })}</div>
      <p>${esc(x.summary)}</p>
      <div class="row"><button class="btn primary" id="sailIt">${esc(t(S, 'ui.sailIt'))}</button></div>
      <p class="eyebrow-label route-head">${esc(t(S, 'ui.route'))}</p>
      ${routeHtml(c, stops)}
      ${spec([
        [t(S, 'ui.code'), `<b>${esc(codeOf(c, beats))}</b>`],
        [t(S, 'ui.beats'), esc(t(S, 'ui.beatsN', { n: nBeats }))],
        [t(S, 'ui.legs'), esc(t(S, 'ui.legsN', { n: track.legs.length }))],
        [t(S, 'ui.finish'), esc(x.finish)],
        [t(S, 'ui.source'), esc(c.source)],
      ])}
      ${x.why ? `<p class="note"><b>${esc(t(S, 'ui.why'))}:</b> ${esc(x.why)}</p>` : ''}
      ${n && ct.notes?.[id] ? `<div class="callout"><div class="eyebrow-label">${esc(t(S, 'ui.classNote', { c: ct.name }))}${n.si ? `<span class="badge-si">${esc(t(S, 'ui.si'))}</span>` : ''}</div><p>${esc(ct.notes[id])}</p></div>` : ''}
      <p class="note">${esc(t(S, 'ui.checkSi'))}</p>
      <div class="row">
        <button class="btn" id="prev" aria-label="${esc(t(S, 'ui.prevAria'))}">${esc(t(S, 'ui.prev'))}</button>
        <button class="btn" id="next" aria-label="${esc(t(S, 'ui.nextAria'))}">${esc(t(S, 'ui.next'))}</button>
        <button class="btn close" id="closeCard" aria-label="${esc(t(S, 'ui.closeAria'))}">${esc(t(S, 'ui.close'))}</button>
      </div>`;
    $('prev').onclick = () => step(-1); $('next').onclick = () => step(1);
    $('closeCard').onclick = () => select(null);
    $('sailIt').onclick = () => openPlayer(id);
    $('cardBeats')?.addEventListener('click', e => {
      const b = e.target.closest('button[data-beats]'); if (!b) return;
      state.beats[id] = +b.dataset.beats; renderCard(); renderGrid();
    });
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
  PHONE.addEventListener?.('change', () => setSheet(!!state.selected && state.view === 'library'));

  renderFilters(); renderGrid(); renderCard(); renderIntroInline();

  /* ---------------- views ---------------- */
  let player = null, board = null, quiz = null;
  const ctx = { S, C, lang, state, txt, nameOf, codeOf, beatsFor, artT, stopName, stopDetail, routeHtml, routeLine, legWord, sideWord, flagsHref,
    entries: () => entries, byId: () => byId, typical: () => typical, base, openPlayer: id => openPlayer(id), showInLibrary: id => { setView('library'); select(id, false); } };
  const viewSeg = $('viewSeg');
  const VIEWS = ['library', 'player', 'board', 'quiz'];
  function setView(v) {
    if (!VIEWS.includes(v)) v = 'library';
    state.view = v;
    for (const b of viewSeg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === v));
    for (const k of VIEWS) $(`view-${k}`).hidden = k !== v;
    setSheet(v === 'library' && !!state.selected);
    if (v === 'player' && !player) player = createPlayer($('view-player'), ctx);
    if (v !== 'player') player?.pause();
    if (v === 'board' && !board) board = createBoard($('view-board'), ctx);
    if (v === 'quiz' && !quiz) quiz = createQuiz($('view-quiz'), ctx);
    if (location.hash.slice(1) !== v) history.replaceState(null, '', v === 'library' ? location.pathname + location.search : `#${v}`);
  }
  function openPlayer(id, beats) {
    if (beats) state.beats[id] = beats;
    setView('player'); player.load(id);
    scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }
  viewSeg.addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (b) setView(b.dataset.view); });
  addEventListener('hashchange', () => setView(location.hash.slice(1)));
  ctx.openPlayer = (id, beats) => openPlayer(id, beats);
  setView(location.hash.slice(1));
  if (params.get('course') && byId[params.get('course')]) {
    const id = params.get('course');
    if (+params.get('beats')) state.beats[id] = +params.get('beats');
    if (state.view === 'player') player.load(id); else select(id, false);
  }

  window.youngsails = { state, entries: () => entries, S, base, overlays, player: () => player, board: () => board, quiz: () => quiz, buildTrack, stateAt };
}

/* =====================================================================
   Course player: a boat sails the route leg by leg
   ===================================================================== */
const SPEED = 0.11;   // course units per second at 1× (a square beat with tacks ≈ 13 s)

function createPlayer(root, ctx) {
  const { S, C, state } = ctx;
  const P_ = (k, v) => t(S, `player.${k}`, v);
  const opts = { speed: 1, shift: 0 };
  let c = null, beats = 2, track = null, proj = null, s = 0, running = false, raf = 0, last = 0;

  const seg = (name, items, cur) => items.map(([v, label]) => `<button data-${name}="${v}" aria-pressed="${String(v) === String(cur)}">${esc(label)}</button>`).join('');
  root.innerHTML = `
    <div class="wiki-panel panel pl-intro"><h2>${esc(P_('heading'))}</h2><p>${esc(P_('intro'))}</p></div>
    <div class="player">
      <div class="pl-col pl-main">
        <figure class="scene panel pl-scene"><figcaption id="plCaption"></figcaption><div class="pl-art" id="plArt"></div></figure>
      </div>
      <div class="pl-col pl-side">
        <div class="clock panel pl-status" aria-live="polite">
          <div class="phase" id="plCode"></div>
          <div class="time pl-leg" id="plLeg"></div>
          <div class="sub" id="plSub"></div>
          <div class="pl-point" id="plPoint"></div>
        </div>
        <div class="tr-controls panel pl-controls">
          <label class="pl-select"><span class="eyebrow-label">${esc(P_('course'))}</span><select id="plCourse"></select></label>
          <div class="row pl-buttons">
            <button class="btn" id="plBack" aria-label="${esc(P_('backAria'))}">${esc(P_('back'))}</button>
            <button class="btn primary" id="plGo"${reduceMotion ? ' hidden' : ''}></button>
            <button class="btn" id="plStep" aria-label="${esc(P_('stepAria'))}">${esc(P_('step'))}</button>
            <button class="btn" id="plReset">${esc(P_('reset'))}</button>
          </div>
          ${reduceMotion ? `<p class="note" style="margin:0">${esc(P_('reduced'))}</p>` : ''}
          <div id="plBeatsWrap"></div>
          <div${reduceMotion ? ' hidden' : ''}><span class="eyebrow-label">${esc(P_('speed'))}</span>
            <div class="seg" role="group" id="plSpeed" aria-label="${esc(P_('speed'))}">${seg('speed', [1, 2, 3, 4].map(k => [k, `${k}×`]), 1)}</div></div>
          <div><span class="eyebrow-label">${esc(P_('wind'))}</span>
            <div class="seg" role="group" id="plShift" aria-label="${esc(P_('wind'))}">${seg('shift', [[0, P_('steady')], [20, P_('shiftRight')], [-20, P_('shiftLeft')]], 0)}</div></div>
        </div>
        <div class="wiki-panel panel pl-route"><h3>${esc(t(S, 'ui.route'))}</h3><div id="plRoute"></div></div>
        <div class="rulebox pl-note"><p id="plNote"></p></div>
      </div>
    </div>`;
  const q = sel => root.querySelector(sel);

  function fillSelect() {
    const list = ctx.entries();
    q('#plCourse').innerHTML = list.map(e => `<option value="${esc(e.id)}"${c && e.id === c.id ? ' selected' : ''}>${esc(ctx.codeOf(e))} · ${esc(ctx.nameOf(e))}</option>`).join('');
  }
  function load(id) {
    const list = ctx.entries();
    c = ctx.byId()[id] || list.find(e => ctx.typical().has(e.id)) || list[0];
    const u = new URL(location.href); u.searchParams.set('course', c.id); history.replaceState(null, '', u);
    fillSelect();
    const b = beatsInfo(c);
    q('#plBeatsWrap').innerHTML = b.fixed ? '' : `<span class="eyebrow-label">${esc(t(S, 'ui.board'))}</span>
      <div class="seg" role="group" id="plBeats" aria-label="${esc(t(S, 'ui.beatsAria'))}">${Array.from({ length: b.max - b.min + 1 }, (_, k) => b.min + k)
        .map(n => `<button data-beats="${n}" aria-pressed="${n === ctx.beatsFor(c)}">${esc(ctx.codeOf(c, n))}</button>`).join('')}</div>`;
    rebuild(true);
  }
  // Rebuild the track (course, beats or wind changed). `restart` puts the boat back on the start line.
  function rebuild(restart) {
    beats = ctx.beatsFor(c);
    const frac = track ? s / track.total : 0;
    track = buildTrack(c, { beats, shift: opts.shift });
    s = restart ? 0 : frac * track.total;
    proj = fullProjection(c);
    q('#plArt').innerHTML = courseSVG(c, { beats, T: ctx.artT(c), player: true, shift: opts.shift });
    q('#plCaption').textContent = `${ctx.codeOf(c)} · ${ctx.nameOf(c)}`;
    q('#plRoute').innerHTML = ctx.routeHtml(c, track.stops, 'live');
    q('#plNote').innerHTML = noteHtml();
    render();
  }
  function noteHtml() {
    if (!opts.shift) return `${esc(P_('siNote'))}`;
    return `${esc(P_('shiftNote', { d: Math.abs(opts.shift), dir: P_(opts.shift > 0 ? 'right' : 'left') }))} <a href="${esc(ctx.flagsHref('C'))}">${esc(t(S, 'teach.flagNames.C'))} →</a>`;
  }

  /* ----- drawing ----- */
  function render() {
    const st = stateAt(track, s), leg = st.leg, n = track.legs.length;
    const X = proj.X(st.pos), Y = proj.Y(st.pos);
    const hd = Math.atan2(st.heading[0], st.heading[1]) * 180 / Math.PI;
    const boom = boomFor(st.twa) * (st.tack === 'starboardTack' ? 1 : -1);   // starboard tack: boom out to port
    q('#csBoat').setAttribute('transform', `translate(${X.toFixed(1)} ${Y.toFixed(1)}) rotate(${hd.toFixed(1)})`);
    q('#csBoom').setAttribute('transform', `rotate(${boom.toFixed(1)} 0 -3)`);
    // trail: what the boat has sailed on this leg; ghost: the rest of the leg
    const u = s - leg.start;
    let k = 1; while (k < leg.cum.length && leg.cum[k] <= u) k++;
    const sailed = leg.pts.slice(0, k).concat([st.pos]);
    q('#csTrail').setAttribute('d', trackPath(sailed, proj));
    q('#csGhost').setAttribute('d', trackPath([st.pos, ...leg.pts.slice(k)], proj));
    root.querySelectorAll('.cs-leg').forEach(l => l.classList.toggle('on', +l.dataset.leg === leg.i));
    root.querySelectorAll('[data-glyph] .cs-round').forEach(g => g.classList.remove('on'));
    if (st.rounding && leg.to.id) root.querySelector(`[data-glyph="${CSS.escape(leg.to.id)}"] .cs-round`)?.classList.add('on');
    root.querySelectorAll('.cs-mark').forEach(m => m.classList.toggle('next', m.dataset.mark === leg.to.id));
    // status
    const done = s >= track.total - 1e-6;
    q('#plCode').textContent = ctx.codeOf(c);
    q('#plLeg').textContent = done ? P_('finished') : ctx.legWord(leg.family);
    q('#plSub').textContent = done ? P_('finishedSub') : P_('legOf', { i: leg.i + 1, n, from: ctx.stopName(leg.from), to: ctx.stopName(leg.to) });
    const point = t(C, `pointsOfSail.${leg.tacking ? 'closeHauled' : leg.point}`), tack = t(C, `trim.${st.tack}`);
    q('#plPoint').textContent = done ? '' : st.rounding ? P_('rounding', { m: ctx.stopName(leg.to), side: ctx.sideWord(leg.to.side) })
      : `${point} · ${tack}${leg.tacking ? ` · ${P_('tacking')}` : ''}`;
    root.querySelectorAll('#plRoute li').forEach(li => {
      const i = +li.dataset.stop;
      li.classList.toggle('done', i <= leg.i || done);
      li.classList.toggle('on', !done && i === leg.i + 1);
    });
    const go = q('#plGo');
    go.textContent = running ? P_('pause') : done ? P_('again') : s > 0 ? P_('resume') : P_('play');
  }

  /* ----- loop ----- */
  function loop(ts) {
    const dt = Math.min(.1, (ts - last) / 1000); last = ts;
    if (running) {
      s = Math.min(track.total, s + dt * SPEED * opts.speed);
      if (s >= track.total) running = false;
    }
    render();
    raf = running ? requestAnimationFrame(loop) : 0;
  }
  function play() {
    if (reduceMotion) return;
    if (s >= track.total - 1e-6) s = 0;
    running = true; last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
  }
  function pause() { running = false; if (track) render(); }
  // Step to the end of the current leg (the next mark), or back to the start of the leg.
  function stepFwd() {
    pause();
    const st = stateAt(track, s), end = st.leg.start + st.leg.length;
    s = s < end - 1e-6 ? end : Math.min(track.total, (track.legs[st.leg.i + 1] || st.leg).start + (track.legs[st.leg.i + 1] || st.leg).length);
    render();
  }
  function stepBack() {
    pause();
    const st = stateAt(track, s);
    s = s > st.leg.start + 1e-6 ? st.leg.start : Math.max(0, (track.legs[st.leg.i - 1] || st.leg).start);
    render();
  }

  q('#plGo').onclick = () => (running ? pause() : play());
  q('#plStep').onclick = stepFwd;
  q('#plBack').onclick = stepBack;
  q('#plReset').onclick = () => { pause(); s = 0; render(); };
  q('#plCourse').onchange = e => { pause(); load(e.target.value); };
  const pick = (id, key, apply) => root.addEventListener('click', e => {
    const b = e.target.closest(`#${id} button[data-${key}]`); if (!b) return;
    root.querySelectorAll(`#${id} button`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    apply(b.dataset[key]);
  });
  pick('plSpeed', 'speed', v => { opts.speed = +v; });
  pick('plShift', 'shift', v => { opts.shift = +v; rebuild(false); });
  pick('plBeats', 'beats', v => { pause(); state.beats[c.id] = +v; rebuild(true); });
  root.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === ' ' && !e.target.matches('button')) { e.preventDefault(); running ? pause() : play(); }
  });

  load(new URLSearchParams(location.search).get('course'));
  return {
    load, play, pause, opts,
    get s() { return s; }, set s(v) { s = v; render(); }, get track() { return track; },
    classChanged() { pause(); load(ctx.byId()[c?.id] ? c.id : null); },
  };
}

/* =====================================================================
   Course-board decoder: type what the committee boat shows
   ===================================================================== */
function createBoard(root, ctx) {
  const { S, state } = ctx;
  const B = (k, v) => t(S, `board.${k}`, v);
  root.innerHTML = `
    <div class="wiki-panel panel"><h2>${esc(B('heading'))}</h2><p>${esc(B('intro'))}</p></div>
    <div class="board-wrap">
      <div class="panel board-panel">
        <label class="board-face"><span class="eyebrow-label">${esc(B('label'))}</span>
          <input id="bdInput" type="text" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="L2">
        </label>
        <p class="note">${esc(B('hint'))}</p>
        <div class="filter-row bd-picks" id="bdPicks"></div>
      </div>
      <div class="panel wiki-panel bd-result" id="bdResult" aria-live="polite"></div>
    </div>`;
  const q = sel => root.querySelector(sel), input = q('#bdInput');

  function picks() {
    const typ = ctx.entries().filter(e => ctx.typical().has(e.id)).map(e => ctx.codeOf(e, beatsInfo(e).def));
    return [...new Set([...typ, 'L3', 'LA2', 'W2', 'TL3', 'TW2', 'OW2', '7'])];
  }
  function renderPicks() { q('#bdPicks').innerHTML = picks().map(k => `<button class="tg" data-code="${esc(k)}">${esc(k)}</button>`).join(''); }

  // "L3" → { letters: 'L', n: 3, course } ; course is the class course if there is one.
  function decode(raw) {
    const code = String(raw || '').toUpperCase().replace(/[\s\-–—.]/g, '');
    const m = code.match(/^([A-Z]+)(\d*)$/);
    if (!m) return { code, kind: 'unknown' };
    const letters = m[1], n = m[2] ? +m[2] : null;
    // the class's courses first, then any course of the page (e.g. IOD while ILCA is chosen)
    const list = ctx.entries().filter(e => e.code === letters);
    const course = list.find(e => (e.classes || []).includes(state.cls)) || list[0] || ctx.base.courses.find(e => e.code === letters);
    if (course) {
      const b = beatsInfo(course);
      if (b.fixed) return { code, kind: n == null || n === b.def ? 'course' : 'odd', letters, n: b.def, course };
      if (n == null) return { code, kind: 'noNumber', letters, n: b.def, course };
      if (n < b.min || n > 6) return { code, kind: 'odd', letters, n, course };
      return { code, kind: 'course', letters, n, course, many: n > b.max };
    }
    if ((ctx.base.designations || []).includes(letters)) return { code, kind: 'letters', letters, n };
    return { code, kind: 'unknown' };
  }
  function show(raw) {
    const r = decode(raw), out = q('#bdResult');
    if (!r.code) { out.innerHTML = `<p class="note">${esc(B('empty'))}</p>`; return; }
    const siMsg = `<div class="callout"><div class="eyebrow-label"><span class="badge-si">${esc(t(S, 'ui.siBadge'))}</span></div><p>${esc(B('lookSi'))}</p></div>`;
    const beatsLine = n => (n ? `<p>${esc(B('beatsLine', { n }))}</p>` : '');
    if (r.kind === 'unknown') { out.innerHTML = `<h2 class="bd-code">${esc(r.code)}</h2><p>${esc(B('unknown', { code: r.code }))}</p>${siMsg}`; return; }
    if (r.kind === 'letters') {
      out.innerHTML = `<h2 class="bd-code">${esc(r.code)}</h2><p><b>${esc(r.letters)}</b> = ${esc(t(S, `designations.${r.letters}`))}</p>${beatsLine(r.n)}
        <p>${esc(B('noDiagram'))}</p>${siMsg}`;
      return;
    }
    const c = r.course, n = Math.max(beatsInfo(c).min, Math.min(r.n, 6)), here = !!ctx.byId()[c.id];
    const stops = resolveStops(c, n);
    const extra = r.kind === 'noNumber' ? `<p class="note">${esc(B('noNumber', { code: ctx.codeOf(c, n) }))}</p>`
      : r.kind === 'odd' ? `<p class="note">${esc(B('odd'))}</p>` : r.many ? `<p class="note">${esc(B('many'))}</p>` : '';
    out.innerHTML = `<h2 class="bd-code">${esc(r.code)}</h2>
      <p><b>${esc(r.letters)}</b> = ${esc(t(S, `designations.${r.letters}`))}${(c.classes || []).includes(state.cls) && c.id !== c.code ? ` <span class="badge-si">${esc(t(S, 'ui.typical', { c: t(S, `classes.${state.cls}.name`) }))}</span>` : ''}</p>
      ${beatsInfo(c).fixed ? '' : beatsLine(n)}${extra}
      <div class="course-art bd-art">${courseSVG(c, { beats: n, T: ctx.artT(c) })}</div>
      <p class="route-line"><b>${esc(ctx.routeLine(stops))}</b></p>
      ${here ? `<div class="row"><button class="btn primary" id="bdSail">${esc(t(S, 'ui.sailIt'))}</button><button class="btn" id="bdLib">${esc(B('openCard'))}</button></div>`
        : `<p class="note">${esc(B('otherClass', { c: (c.classes || []).map(k => t(S, `classes.${k}.name`)).join(', ') }))}</p>`}
      ${siMsg}`;
    if (!here) return;
    q('#bdSail').onclick = () => ctx.openPlayer(c.id, beatsInfo(c).fixed ? undefined : Math.min(beatsInfo(c).max, n));
    q('#bdLib').onclick = () => { if (!beatsInfo(c).fixed) state.beats[c.id] = Math.min(beatsInfo(c).max, n); ctx.showInLibrary(c.id); };
  }
  input.addEventListener('input', () => show(input.value));
  q('#bdPicks').addEventListener('click', e => { const b = e.target.closest('button[data-code]'); if (!b) return; input.value = b.dataset.code; show(b.dataset.code); });
  renderPicks();
  input.value = picks()[0] || 'L2'; show(input.value);
  return { decode, show, classChanged() { renderPicks(); show(input.value); } };
}

/* =====================================================================
   Quiz: next mark, port or starboard, beat/reach/run, where is the finish
   ===================================================================== */
function createQuiz(root, ctx) {
  const { S } = ctx;
  const Q = (k, v) => t(S, `quiz.${k}`, v);
  const N = 10;
  let qs = [], i = 0, score = 0, answered = false;
  const ordinal = n => Q(`times.${Math.min(n, 4)}`);

  function welcome() {
    root.innerHTML = `<div class="quiz wiki-panel panel"><h2>${esc(Q('heading'))}</h2><p>${esc(Q('intro'))}</p>
      <div class="row"><button class="btn primary" id="qzStart">${esc(Q('start'))}</button></div></div>`;
    root.querySelector('#qzStart').onclick = start;
  }
  // Question makers. Each returns { kind, prompt, art, options: [{key,label}], answer, explain } or null.
  const makers = {
    next() {
      const c = pickOne(ctx.entries()), n = ctx.beatsFor(c), stops = resolveStops(c, n);
      const idx = stops.map((s, k) => k).filter(k => k > 0 && k < stops.length - 1);
      const k = pickOne(idx), s = stops[k];
      const label = x => (x.type === 'gate' ? ctx.stopName(x) : ctx.stopName(x));
      const times = stops.slice(1, k + 1).filter(x => label(x) === label(s)).length;
      const answer = label(stops[k + 1]);
      const pool = [...new Set(stops.slice(1).map(label))];
      if (pool.length < 2) return null;
      const opts = shuffle([answer, ...shuffle(pool.filter(x => x !== answer)).slice(0, 3)]);
      const track = buildTrack(c, { beats: n }), leg = track.legs[k - 1];
      return {
        kind: 'next', course: c, beats: n,
        prompt: Q('qNext', { code: ctx.codeOf(c, n), m: label(s), times: ordinal(times) }),
        art: courseSVG(c, { beats: n, T: ctx.artT(c), highlightMark: s.id, highlightLeg: k - 1 }),
        boatAt: leg ? leg.pts[leg.pts.length - 1] : null,
        options: opts.map(o => ({ key: o, label: o })), answer,
        explain: `${ctx.codeOf(c, n)}: ${ctx.routeLine(stops)}`,
      };
    },
    side() {
      const c = pickOne(ctx.entries()), n = ctx.beatsFor(c), stops = resolveStops(c, n);
      const ids = [...new Set(stops.filter(s => s.type === 'mark' || s.type === 'gate').flatMap(s => (s.type === 'gate' ? s.gateIds : [s.id])))];
      const id = pickOne(ids), side = id.endsWith('s') && c.marks[id].gate ? 'starboard' : (c.marks[id].leave || (c.marks[id].gate ? 'port' : 'port'));
      return {
        kind: 'side', course: c, beats: n,
        prompt: Q('qSide', { code: ctx.codeOf(c, n), m: id }),
        art: courseSVG(c, { beats: n, T: ctx.artT(c), highlightMark: id }),
        options: ['port', 'starboard'].map(k => ({ key: k, label: t(S, `quiz.side.${k}`) })), answer: side,
        explain: c.marks[id].gate ? Q('explainGate', { m: id, side: ctx.sideWord(side) }) : Q('explainSide', { m: id, side: ctx.sideWord(side) }),
      };
    },
    leg() {
      const c = pickOne(ctx.entries()), n = ctx.beatsFor(c), track = buildTrack(c, { beats: n });
      const legs = track.legs.filter(l => l.length > 0.3);
      const leg = pickOne(legs);
      return {
        kind: 'leg', course: c, beats: n,
        prompt: Q('qLeg', { from: ctx.stopName(leg.from), to: ctx.stopName(leg.to) }),
        art: courseSVG(c, { beats: n, T: ctx.artT(c), highlightLeg: leg.i }),
        options: ['beat', 'reach', 'run'].map(k => ({ key: k, label: ctx.legWord(k) })), answer: leg.family,
        explain: Q(`explainLeg.${leg.family}`),
      };
    },
    finish() {
      const c = pickOne(ctx.entries()), n = ctx.beatsFor(c);
      const f = [(c.finish.pin[0] + c.finish.committee[0]) / 2, (c.finish.pin[1] + c.finish.committee[1]) / 2];
      const m1 = c.marks['1'].at, st = [(c.start.pin[0] + c.start.committee[0]) / 2, (c.start.pin[1] + c.start.committee[1]) / 2];
      const decoys = [[m1[0], m1[1] + 0.14], st, [st[0] + 0.32, st[1] - 0.2], [m1[0] + 0.32, m1[1] - 0.25]]
        .filter(p => Math.hypot(p[0] - f[0], p[1] - f[1]) > 0.22);
      const pts = shuffle([f, ...shuffle(decoys).slice(0, 2)]);
      const letters = ['A', 'B', 'C'], ans = letters[pts.indexOf(f)];
      return {
        kind: 'finish', course: c, beats: n,
        prompt: Q('qFinish', { code: ctx.codeOf(c, n) }),
        art: courseSVG(c, { beats: n, T: ctx.artT(c), hideFinish: true, candidates: pts.map((p, k) => [p[0], p[1], letters[k]]) }),
        options: letters.map(k => ({ key: k, label: k })), answer: ans,
        explain: `${ctx.codeOf(c, n)}: ${ctx.txt(c.id).finish || ''}`,
      };
    },
  };
  function start() {
    const kinds = shuffle(['next', 'next', 'next', 'side', 'side', 'side', 'leg', 'leg', 'finish', 'finish']).slice(0, N);
    qs = kinds.map(k => { for (let tries = 0; tries < 8; tries++) { const x = makers[k](); if (x) return x; } return makers.side(); });
    i = 0; score = 0; show();
  }
  function show() {
    answered = false;
    const x = qs[i];
    root.innerHTML = `<div class="quiz wiki-panel panel">
      <div class="eyebrow" style="display:flex;justify-content:space-between;gap:8px"><span class="chip">${esc(Q(`mode.${x.kind}`))}</span>
        <span class="note">${esc(Q('progress', { i: i + 1, n: qs.length }))} · ${esc(Q('score', { s: score }))}</span></div>
      <h2 class="q-prompt">${esc(x.prompt)}</h2>
      <div class="q-body"><div class="course-art q-course">${x.art}</div>
      <div class="q-side"><div class="answers ${x.options.length === 3 && x.kind !== 'leg' ? 'three' : ''}" id="qzAnswers">${x.options.map(o => `<button class="answer" data-key="${esc(o.key)}">${esc(o.label)}</button>`).join('')}</div>
      <p class="feedback" id="qzFeedback" aria-live="polite"></p>
      <div class="row"><button class="btn primary" id="qzNext" hidden>${esc(Q('next'))}</button></div></div></div></div>`;
    root.querySelector('#qzAnswers').addEventListener('click', ev => {
      const b = ev.target.closest('.answer'); if (!b || answered) return;
      answered = true;
      const ok = b.dataset.key === x.answer; if (ok) score++;
      root.querySelectorAll('.answer').forEach(a => { a.disabled = true; if (a.dataset.key === x.answer) a.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      const fb = root.querySelector('#qzFeedback');
      const right = x.options.find(o => o.key === x.answer)?.label;
      fb.textContent = `${ok ? Q('right') : Q('wrong', { a: right })} ${x.explain || ''}`; fb.className = `feedback ${ok ? 'ok' : 'no'}`;
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
  return { reset: welcome, start, makers };
}
