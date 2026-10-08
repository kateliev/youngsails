// Young Sails — race courses drawn from data (data/courses/*.json) as inline SVG,
// plus the geometry the course player sails: route expansion, mark roundings,
// tacking on beats.
//
// Coordinates are wind-relative: +y points upwind, +x to starboard when facing
// upwind, 1 unit = one beat. The SVG always has the design wind from the top;
// `shift` (degrees, + = clockwise) turns only the wind, never the marks.
import { pointOfSail } from '../core/sailing.js';

const R = 0.035;           // rounding radius around a mark (course units)
const CLOSE = 45;          // close-hauled angle to the true wind (degrees)
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------------- vector helpers (y up) ---------------- */
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = a => Math.hypot(a[0], a[1]);
const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const right = d => [d[1], -d[0]];
const leftOf = d => [-d[1], d[0]];
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
// clockwise rotation (compass sense) by d degrees
const rot = (v, d) => { const c = Math.cos(rad(d)), s = Math.sin(rad(d)); return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c]; };
const windFrom = shift => rot([0, 1], shift || 0);
// angle between a heading and the direction the wind comes from (0 = head to wind, 180 = dead downwind)
export const twaOf = (d, shift = 0) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(d), windFrom(shift))))));
// Leg family by the design wind: < 60° beat, > 150° run, else reach (see courses-sources.md).
export const familyOf = twa => (twa < 60 ? 'beat' : twa > 150 ? 'run' : 'reach');

/* ---------------- route ---------------- */
export function beatsInfo(c) {
  const b = c.beats || {};
  return b.fixed ? { fixed: true, min: b.fixed, max: b.fixed, def: b.fixed } : { fixed: false, min: b.min, max: b.max, def: b.default ?? b.min };
}
// Route tokens for `beats` beats.
export function expandRoute(c, beats) {
  const r = c.route, b = c.beats || {};
  if (b.fixed || !r.loop) return [...r.head];
  const n = Math.max(0, (beats ?? b.default) - b.extra);
  const out = [...r.head];
  for (let i = 0; i < n; i++) out.push(...r.loop);
  return out.concat(r.tail || []);
}
// Side a mark is left on: the mark's own `leave`, else s/p of a gate mark, else port.
export function sideOf(c, id) {
  const m = c.marks[id];
  if (m?.leave) return m.leave;
  if (m?.gate) return id.endsWith('s') ? 'starboard' : 'port';
  return 'port';
}
const gateMarks = (c, g) => Object.keys(c.marks).filter(id => c.marks[id].gate === g);
const lineMid = l => mid(l.pin, l.committee);
const sameLine = c => c.finish && c.start && len(sub(lineMid(c.start), lineMid(c.finish))) < 1e-6
  && len(sub(c.start.committee, c.finish.committee)) < 1e-6;
export { sameLine };

// Stops: the route resolved to points; gates resolved to the mark that is rounded.
// A gate mark is the one nearer to the next stop; on a tie the two are used in turn
// (either is allowed, so the player shows both).
export function resolveStops(c, beats) {
  const toks = expandRoute(c, beats);
  const centre = tok => {
    if (tok === 'start') return lineMid(c.start);
    if (tok === 'finish') return lineMid(c.finish);
    if (tok.startsWith('gate')) { const g = gateMarks(c, tok.slice(4)); return mid(c.marks[g[0]].at, c.marks[g[1]].at); }
    return c.marks[tok].at;
  };
  const turn = {};
  return toks.map((tok, i) => {
    if (tok === 'start' || tok === 'finish') return { tok, type: tok, at: centre(tok) };
    if (tok.startsWith('gate')) {
      const g = tok.slice(4), ids = gateMarks(c, g), next = centre(toks[i + 1] || 'finish');
      const d = ids.map(id => len(sub(c.marks[id].at, next)));
      let pick = d[0] < d[1] ? 0 : 1;
      if (Math.abs(d[0] - d[1]) < 0.02) { turn[g] = (turn[g] ?? -1) + 1; pick = turn[g] % 2; }
      const id = ids[pick];
      return { tok, type: 'gate', gate: g, gateIds: ids, id, side: sideOf(c, id), at: c.marks[id].at, centre: centre(tok) };
    }
    return { tok, type: 'mark', id: tok, side: sideOf(c, tok), at: c.marks[tok].at };
  });
}

/* ---------------- track ---------------- */
function arc(M, E, X, side) {
  const a1 = Math.atan2(E[1] - M[1], E[0] - M[0]), a2 = Math.atan2(X[1] - M[1], X[0] - M[0]);
  let sw = a2 - a1;
  if (side === 'port') { while (sw <= 0) sw += 2 * Math.PI; } else { while (sw >= 0) sw -= 2 * Math.PI; }
  const n = Math.max(2, Math.ceil(Math.abs(sw) / (Math.PI / 14)));
  const pts = [];
  for (let k = 0; k <= n; k++) { const a = a1 + sw * k / n; pts.push([M[0] + R * Math.cos(a), M[1] + R * Math.sin(a)]); }
  return pts;
}
// From P to Q: straight, or close-hauled tacks when Q is closer than 45° to the wind.
// `endTack` is the tack of the last board ('starboard' approaches a port-hand mark on the layline).
function sail(P, Q, shift, endTack, firstTack) {
  const D = sub(Q, P);
  if (twaOf(D, shift) >= CLOSE - 0.5) return { pts: [P, Q], tacking: false };
  const w = windFrom(shift);
  const uS = rot(w, -CLOSE), uP = rot(w, CLOSE);   // starboard tack heads left of the wind, port tack right
  const det = uS[0] * uP[1] - uS[1] * uP[0];
  const a = (D[0] * uP[1] - D[1] * uP[0]) / det, b = (uS[0] * D[1] - uS[1] * D[0]) / det;   // D = a·uS + b·uP
  const k = Math.max(1, Math.min(4, Math.round(Math.min(a, b) / 0.14)));
  // boards alternate; the end tack gets k+1 boards, the other k
  let tackSeq = [];
  const other = endTack === 'starboard' ? 'port' : 'starboard';
  for (let i = 0; i < 2 * k + 1; i++) tackSeq.push(i % 2 === 0 ? endTack : other);
  if (firstTack && firstTack !== endTack) {   // start on the wanted tack: k boards each, starting with firstTack
    tackSeq = []; for (let i = 0; i < 2 * k; i++) tackSeq.push(i % 2 === 0 ? firstTack : endTack);
  }
  const nS = tackSeq.filter(x => x === 'starboard').length, nP = tackSeq.length - nS;
  const pts = [P]; let p = P;
  for (const tk of tackSeq) { p = add(p, tk === 'starboard' ? mul(uS, a / nS) : mul(uP, b / nP)); pts.push(p); }
  pts[pts.length - 1] = Q;
  return { pts, tacking: true };
}

// The whole race as legs. Each leg ends with the rounding of its mark (or the finish).
// leg = { i, from, to, family, twa, tacking, pts, cum[], length, roundAt (distance where the rounding starts), point }
export function buildTrack(c, { beats, shift = 0 } = {}) {
  const stops = resolveStops(c, beats);
  const centreOf = s => (s.type === 'gate' ? s.centre : s.at);
  const geo = stops.map((s, i) => {
    if (s.type !== 'mark' && s.type !== 'gate') return null;
    const din = unit(sub(s.at, stops[i - 1].at));
    const nx = stops[i + 1], dout = unit(sub(nx ? centreOf(nx) : s.at, s.at));
    const side = s.side === 'port' ? right : leftOf;
    return { E: add(s.at, mul(side(din), R)), X: add(s.at, mul(side(dout), R)), din, dout };
  });
  const legs = [];
  let P = stops[0].at;
  for (let i = 1; i < stops.length; i++) {
    const s = stops[i], from = stops[i - 1];
    const fam = familyOf(twaOf(sub(centreOf(s), centreOf(from))));
    let Q, tail = [];
    if (s.type === 'finish') {
      Q = s.at;
    } else {
      Q = geo[i].E;
      tail = arc(s.at, geo[i].E, geo[i].X, s.side);
    }
    const endTack = s.type !== 'finish' && s.side === 'starboard' ? 'port' : 'starboard';
    const res = sail(P, Q, shift, endTack, i === 1 ? 'starboard' : null);
    let pts = res.pts;
    if (s.type === 'finish') {   // sail on a little past the line
      const last = unit(sub(pts[pts.length - 1], pts[pts.length - 2]));
      pts = pts.concat([add(Q, mul(last, 0.05))]);
    }
    const roundIdx = pts.length - 1;
    pts = pts.concat(tail.slice(1));
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + len(sub(pts[k], pts[k - 1])));
    const twaSailed = twaOf(sub(centreOf(s), centreOf(from)), shift);
    legs.push({
      i: i - 1, from, to: s, family: fam, twa: twaOf(sub(centreOf(s), centreOf(from))), twaSailed, tacking: res.tacking,
      pts, cum, length: cum[cum.length - 1], roundAt: s.type === 'finish' ? cum[cum.length - 1] : cum[roundIdx],
      point: res.tacking ? 'closeHauled' : pointOfSail(twaSailed, 20),
    });
    P = s.type === 'finish' ? Q : geo[i].X;
  }
  let total = 0;
  for (const l of legs) { l.start = total; total += l.length; }
  return { stops, legs, total, shift };
}

// Position, heading and sailing state at distance s along the track.
export function stateAt(track, s) {
  s = Math.max(0, Math.min(track.total, s));
  let leg = track.legs.find(l => s <= l.start + l.length + 1e-9) || track.legs[track.legs.length - 1];
  const at = d => {
    const L = track.legs.find(l => d <= l.start + l.length + 1e-9) || track.legs[track.legs.length - 1];
    const u = Math.max(0, Math.min(L.length, d - L.start));
    let k = 1; while (k < L.cum.length - 1 && L.cum[k] < u) k++;
    const t = (u - L.cum[k - 1]) / ((L.cum[k] - L.cum[k - 1]) || 1);
    return add(L.pts[k - 1], mul(sub(L.pts[k], L.pts[k - 1]), t));
  };
  const pos = at(s), eps = 0.012;
  const h = unit(sub(at(Math.min(track.total, s + eps)), at(Math.max(0, s - eps))));
  const w = windFrom(track.shift);
  const twa = twaOf(h, track.shift);
  const tack = dot(w, right(h)) >= 0 ? 'starboardTack' : 'portTack';   // wind over the starboard side = starboard tack
  const u = s - leg.start;
  return { pos, heading: h, twa, tack, leg, rounding: leg.to.type !== 'finish' && u >= leg.roundAt - 1e-9, u };
}

/* ---------------- drawing ---------------- */
function boundsOf(c, extra = []) {
  const pts = [...Object.values(c.marks).map(m => m.at), c.start.pin, c.start.committee, c.finish.pin, c.finish.committee, ...extra];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
// Projection to SVG: fit in maxW × maxH px, never narrower than `minAspect` × height.
export function projection(c, { maxW = 600, maxH = 560, pad = 0.16, top = 0.2, minAspect = 0.78, extra = [] } = {}) {
  const b = boundsOf(c, extra);
  let x0 = b.x0 - pad, x1 = b.x1 + pad, y0 = b.y0 - pad, y1 = b.y1 + pad + top;
  const s = Math.min(maxW / (x1 - x0), maxH / (y1 - y0));
  let W = (x1 - x0) * s; const H = (y1 - y0) * s;
  if (W < H * minAspect) { const grow = (H * minAspect - W) / s / 2; x0 -= grow; x1 += grow; W = H * minAspect; }
  return { s, W: Math.round(W), H: Math.round(H), X: p => (p[0] - x0) * s, Y: p => (y1 - p[1]) * s, x0, y1 };
}
const f = n => Math.round(n * 10) / 10;
const pathD = (pts, P) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(P.X(p))} ${f(P.Y(p))}`).join('');

// Committee boat glyph (top view, bow to windward) with its flag(s): orange = start, blue = finish.
function committee(x, y, flags, label) {
  const fl = flags.map((col, i) => `<rect x="${f(x + 10 + i * 9)}" y="${f(y - 22)}" width="8" height="6" fill="${col === 'blue' ? '#1f4fb3' : '#ff7a1a'}" stroke="#0c2235" stroke-width=".6"/>`).join('');
  return `<g class="cs-rc"><path class="cs-rc-hull" d="M${f(x)} ${f(y - 12)} c5 4 6 9 6 14 v8 h-12 v-8 c0 -5 1 -10 6 -14z"/>
    <line class="cs-staff" x1="${f(x + 10)}" y1="${f(y - 22)}" x2="${f(x + 10)}" y2="${f(y - 6)}"/>${fl}${label ? `<title>${esc(label)}</title>` : ''}</g>`;
}
// Rounding glyph: an arc around the mark with an arrow head, in the rounding direction.
function roundingGlyph(M, din, dout, side, P, cls = '') {
  const rp = 17;   // px
  const sideFn = side === 'port' ? right : leftOf;
  const E = sideFn(din), X = sideFn(dout);
  // in screen space (y down) the angles flip sign
  let a1 = Math.atan2(-E[1], E[0]), a2 = Math.atan2(-X[1], X[0]);
  let sw = a2 - a1;
  if (side === 'port') { while (sw >= 0) sw -= 2 * Math.PI; } else { while (sw <= 0) sw += 2 * Math.PI; }
  // run in before the mark and out after it, like the rulebook diagrams
  const cx = P.X(M), cy = P.Y(M);
  const p = a => [cx + rp * Math.cos(a), cy + rp * Math.sin(a)];
  const s = p(a1), e = p(a2);
  const inS = [s[0] - din[0] * 18, s[1] + din[1] * 18], outE = [e[0] + dout[0] * 20, e[1] - dout[1] * 20];
  const large = Math.abs(sw) > Math.PI ? 1 : 0, sweepFlag = sw > 0 ? 1 : 0;
  const ah = unit([dout[0], -dout[1]]), an = [-ah[1], ah[0]];
  const tip = outE, b1 = [tip[0] - ah[0] * 7 + an[0] * 4, tip[1] - ah[1] * 7 + an[1] * 4], b2 = [tip[0] - ah[0] * 7 - an[0] * 4, tip[1] - ah[1] * 7 - an[1] * 4];
  return `<g class="cs-round ${cls}"><path d="M${f(inS[0])} ${f(inS[1])} L${f(s[0])} ${f(s[1])} A${rp} ${rp} 0 ${large} ${sweepFlag} ${f(e[0])} ${f(e[1])} L${f(outE[0])} ${f(outE[1])}"/>
    <path class="cs-head" d="M${f(tip[0])} ${f(tip[1])} L${f(b1[0])} ${f(b1[1])} L${f(b2[0])} ${f(b2[1])}Z"/></g>`;
}

// Big wind arrow in the top-left corner, turned by `shift`.
function windArrow(P, shift, label) {
  const x = 34, y = 30;
  return `<g class="cs-wind" id="csWind" transform="translate(${x} ${y}) rotate(${f(shift || 0)})">
    <path d="M-7 -22 h14 v20 h9 l-16 22 l-16 -22 h9 z"/></g>
    <text class="tr-text cs-wind-label" x="${x + 24}" y="${y - 10}">${esc(label)}</text>`;
}

// courseSVG(course, opts) → '<svg …>'.
//   opts.mode    'thumb' (no text) | 'full'
//   opts.beats   number of beats (route) — for the leg lines and rounding glyphs
//   opts.T       labels: { wind, start, finish, startFinish, rc, pin, aria }
//   opts.highlightLeg  leg index drawn in accent;  opts.highlightMark  mark id ringed in accent
//   opts.hideFinish    leave the finishing line out (quiz);  opts.candidates [[x,y,'A'],…] letter badges
//   opts.player  adds the trail and boat layers (#csTrail, #csBoat)
//   opts.shift   wind shift in degrees (arrow only)
export function courseSVG(c, opts = {}) {
  const { mode = 'full', beats, T = {}, player = false, shift = 0 } = opts;
  const thumb = mode === 'thumb';
  const P = projection(c, thumb ? { maxW: 300, maxH: 260, top: 0.04, pad: 0.1, minAspect: 0.9 } : { extra: (opts.candidates || []).map(k => [k[0], k[1]]) });
  const stops = resolveStops(c, beats);
  const centreOf = s => (s.type === 'gate' ? s.centre : s.at);

  // leg lines (centre to centre); duplicates (laps) overlap
  const legLines = stops.slice(1).map((s, i) => {
    const a = centreOf(stops[i]), b = centreOf(s);
    return `<line class="cs-leg${opts.highlightLeg === i ? ' on' : ''}" data-leg="${i}" x1="${f(P.X(a))}" y1="${f(P.Y(a))}" x2="${f(P.X(b))}" y2="${f(P.Y(b))}"/>`;
  }).join('');

  // rounding glyphs: for each mark, its first rounding in the route; gate marks get one each
  const glyphs = [], seen = new Set();
  stops.forEach((s, i) => {
    if (s.type !== 'mark' && s.type !== 'gate') return;
    const ids = s.type === 'gate' ? s.gateIds : [s.id];
    for (const id of ids) {
      if (seen.has(id)) continue; seen.add(id);
      const M = c.marks[id].at;
      const prev = centreOf(stops[i - 1]), nx = stops[i + 1] ? centreOf(stops[i + 1]) : M;
      const din = unit(sub(M, prev));
      // gate marks are drawn as the rulebook's U-turn (either mark may be rounded)
      const dout = c.marks[id].gate && s.type === 'gate' ? mul(din, -1) : unit(sub(nx, M));
      glyphs.push(`<g data-glyph="${esc(id)}">${roundingGlyph(M, din, dout, sideOf(c, id), P)}</g>`);
    }
  });

  const used = new Set(stops.flatMap(s => (s.type === 'gate' ? s.gateIds : s.id ? [s.id] : [])));
  const marks = Object.entries(c.marks).map(([id, m]) => {
    const x = f(P.X(m.at)), y = f(P.Y(m.at)), r = thumb ? 9 : 11;
    const cls = `cs-mark${used.has(id) ? '' : ' unused'}${m.offset ? ' offset' : ''}${opts.highlightMark === id ? ' on' : ''}`;
    const fill = m.colour ? ` style="fill:${esc(m.colour)}"` : '';
    return `<g class="${cls}" data-mark="${esc(id)}"><circle cx="${x}" cy="${y}" r="${r}"${fill}/>${thumb ? '' : `<text x="${x}" y="${f(y + 4.5)}" text-anchor="middle">${esc(id)}</text>`}</g>`;
  }).join('');

  // start and finish lines
  const shared = sameLine(c);
  const line = (l, kind) => {
    const a = [P.X(l.pin), P.Y(l.pin)], b = [P.X(l.committee), P.Y(l.committee)];
    return `<line class="cs-line ${kind}" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}"/><circle class="cs-pin" cx="${f(a[0])}" cy="${f(a[1])}" r="${thumb ? 4 : 5}"/>`;
  };
  const finishShown = !opts.hideFinish;
  let lines = line(c.start, 'start');
  if (finishShown && !shared) lines += line(c.finish, 'finish');
  const rcStart = [P.X(c.start.committee), P.Y(c.start.committee)], rcFin = [P.X(c.finish.committee), P.Y(c.finish.committee)];
  const rcSame = len(sub(c.start.committee, c.finish.committee)) < 1e-6;
  let boats = committee(rcStart[0], rcStart[1], finishShown && rcSame ? ['orange', 'blue'] : ['orange'], T.rc);
  if (finishShown && !rcSame) boats += committee(rcFin[0], rcFin[1], ['blue'], T.rc);

  let labels = '';
  if (!thumb) {
    const lab = (l, text, dy) => { const m = lineMid(l); return `<text class="tr-text cs-line-label" x="${f(P.X(m))}" y="${f(P.Y(m) + dy)}" text-anchor="middle">${esc(text)}</text>`; };
    if (shared && finishShown) labels += lab(c.start, T.startFinish || `${T.start} / ${T.finish}`, 22);
    else {
      labels += lab(c.start, T.start, 22);
      if (finishShown) {
        const fm = lineMid(c.finish), vertical = Math.abs(c.finish.pin[0] - c.finish.committee[0]) < Math.abs(c.finish.pin[1] - c.finish.committee[1]);
        labels += vertical ? `<text class="tr-text cs-line-label" x="${f(P.X(fm) + 12)}" y="${f(P.Y(fm) + 4)}">${esc(T.finish)}</text>`
          : `<text class="tr-text cs-line-label" x="${f(P.X(fm))}" y="${f(P.Y(fm) - 12)}" text-anchor="middle">${esc(T.finish)}</text>`;
      }
    }
  }
  const cands = (opts.candidates || []).map(([x, y, k]) => `<g class="cs-cand"><circle cx="${f(P.X([x, y]))}" cy="${f(P.Y([x, y]))}" r="13"/><text x="${f(P.X([x, y]))}" y="${f(P.Y([x, y]) + 5)}" text-anchor="middle">${esc(k)}</text></g>`).join('');
  const layers = player ? `<path class="cs-trail" id="csTrail" d=""/><path class="cs-ghost" id="csGhost" d=""/><g id="csBoat" class="cs-boat"><g transform="scale(1.35)">${boatGlyph()}</g></g>` : '';
  return `<svg class="course-svg ${thumb ? 'thumb' : ''}" viewBox="0 0 ${P.W} ${P.H}" role="img"${T.aria ? ` aria-label="${esc(T.aria)}"` : ' aria-hidden="true"'}>
    <rect class="tr-sea" x="0" y="0" width="${P.W}" height="${P.H}" rx="${thumb ? 6 : 10}"/>
    ${thumb ? '' : windArrow(P, shift, T.wind)}
    <g class="cs-legs">${legLines}</g>
    ${thumb ? '' : `<g class="cs-glyphs">${glyphs.join('')}</g>`}
    ${lines}${boats}${marks}${labels}${cands}${layers}
  </svg>`;
}
// Projection used by courseSVG in full mode (the player needs it to place the boat).
export const fullProjection = (c, opts = {}) => projection(c, { extra: (opts.candidates || []).map(k => [k[0], k[1]]) });
export const trackPath = (pts, P) => pathD(pts, P);

// Dinghy seen from above, bow up; the boom is a separate line turned by the player.
function boatGlyph() {
  return `<path class="cs-hull" d="M0 -11 C5 -7 6 -1 5.5 9 L-5.5 9 C-6 -1 -5 -7 0 -11Z"/><line class="cs-boom" id="csBoom" x1="0" y1="-3" x2="0" y2="9"/>`;
}
// Boom angle (degrees off the centreline) for a wind angle: the inverse of sailing.js windAngleFromBoom.
export const boomFor = twa => Math.max(6, Math.min(85, (twa - 25) / 1.85));
