// Young Sails — signal flags drawn as inline SVG from pattern descriptions (no image files).
//
// Designs follow the International Code of Signals (ICS), a public international
// standard, and the drawings on the Race Signals pages of the Racing Rules of
// Sailing 2025-2028. Flag colours are data: they are fixed hex values and never
// follow the page theme.
//
// Art ids:
//   ics-A … ics-Z   ICS letter flags (only the ones racing uses are defined)
//   ics-AP          answering pennant (postponement)
//   num-1 … num-9   ICS numeral pennants
//   sub-1           First Substitute (general recall)
//   plain-black | plain-orange | plain-blue | plain-yellow
//   shape-starboard | shape-port | board-minus | board-plus   course-change signals (RRS 33)
//   class           a generic class flag (no class insignia: trademarks)
//   mark-<bg>-<ink> a generic class-style flag in two named colours (e.g. mark-green-red)
//   set-groups      four example group/division flags (yellow, blue, red, green)
//   set-ilca        example ILCA 4 / 6 / 7 flags (yellow, green, white with a red mark)
//   set-fleets3     three example fleet flags (yellow, blue, red)
//   text-XXX        a white flag or board with 2-4 letters or digits (country code, course name)
//
// Proportions: letter flags 5:6 (hoist:fly; the ICS does not fix one ratio, this is
// the common one). Pennants taper to 0.3 of the hoist and are cut off square at the
// fly, as drawn in the rulebook. The First Substitute is a pointed triangle.

const COL = {
  red: '#d7262e', blue: '#1f4fb5', yellow: '#fcd20f', black: '#151515', white: '#ffffff',
  green: '#2e9e3e', orange: '#f2601f', navy: '#12324f',
};
const EDGE = '#7a8894'; // thin outline so white and yellow flags read on a light backing

const R = (x, y, w, h, f) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const P = (pts, f) => `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${f}"/>`;
const C = (cx, cy, r, f) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"/>`;
const L = (x1, y1, x2, y2, s, w) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${s}" stroke-width="${w}"/>`;

const FW = 120, FH = 100;          // letter flag
const PW = 220, PH = 70;           // pennant (answering + numerals)
const outlines = {
  rect: (w, h) => `M0 0H${w}V${h}H0Z`,
  swallow: (w, h) => `M0 0H${w}L${w * .76} ${h / 2}L${w} ${h}H0Z`,
  pennant: (w, h) => { const t = h * .3; return `M0 0L${w} ${(h - t) / 2}V${(h + t) / 2}L0 ${h}Z`; },
  tri: (w, h) => `M0 0L${w} ${h / 2}L0 ${h}Z`,
  peak: (w, h) => `M${w / 2} 0L${w} ${h}H0Z`,
};

/* ---------------- designs ---------------- */
const quarters = (a, b) => R(0, 0, FW / 2, FH / 2, a) + R(FW / 2, 0, FW / 2, FH / 2, b) + R(0, FH / 2, FW / 2, FH / 2, b) + R(FW / 2, FH / 2, FW / 2, FH / 2, a);
const cross = (bg, fg) => R(0, 0, FW, FH, bg) + R(FW / 2 - FH * .1, 0, FH * .2, FH, fg) + R(0, FH * .4, FW, FH * .2, fg);
const saltire = (bg, fg) => R(0, 0, FW, FH, bg) + L(0, 0, FW, FH, fg, FH * .2) + L(FW, 0, 0, FH, fg, FH * .2);
const square = (bg, fg) => { const s = FH * .38; return R(0, 0, FW, FH, bg) + R((FW - s) / 2, (FH - s) / 2, s, s, fg); };
const letter = body => ({ w: FW, h: FH, outline: 'rect', body });
const pennant = body => ({ w: PW, h: PH, outline: 'pennant', body });
const pCross = (bg, fg) => R(0, 0, PW, PH, bg) + R(PW * .27, 0, PH * .16, PH, fg) + R(0, PH * .42, PW, PH * .16, fg);

const DESIGNS = {
  'ics-A': { w: FW, h: FH, outline: 'swallow', body: R(0, 0, FW * .45, FH, COL.white) + R(FW * .45, 0, FW * .55, FH, COL.blue) },
  'ics-C': letter([COL.blue, COL.white, COL.red, COL.white, COL.blue].map((f, i) => R(0, i * FH / 5, FW, FH / 5, f)).join('')),
  'ics-D': letter(R(0, 0, FW, FH, COL.yellow) + R(0, FH / 4, FW, FH / 2, COL.blue)),
  'ics-H': letter(R(0, 0, FW / 2, FH, COL.white) + R(FW / 2, 0, FW / 2, FH, COL.red)),
  'ics-I': letter(R(0, 0, FW, FH, COL.yellow) + C(FW / 2, FH / 2, FH * .24, COL.black)),
  'ics-L': letter(quarters(COL.yellow, COL.black)),
  'ics-M': letter(saltire(COL.blue, COL.white)),
  'ics-N': letter(Array.from({ length: 16 }, (_, k) => { const i = k % 4, j = (k / 4) | 0; return R(i * FW / 4, j * FH / 4, FW / 4, FH / 4, (i + j) % 2 ? COL.white : COL.blue); }).join('')),
  'ics-O': letter(P([[0, 0], [0, FH], [FW, FH]], COL.yellow) + P([[0, 0], [FW, 0], [FW, FH]], COL.red)),
  'ics-P': letter(square(COL.blue, COL.white)),
  'ics-R': letter(cross(COL.red, COL.yellow)),
  'ics-S': letter(square(COL.white, COL.blue)),
  'ics-U': letter(quarters(COL.red, COL.white)),
  'ics-V': letter(saltire(COL.white, COL.red)),
  'ics-X': letter(cross(COL.white, COL.blue)),
  'ics-Y': letter(R(0, 0, FW, FH, COL.yellow) + Array.from({ length: 7 }, (_, k) => { const x = -FH + k * 40; return L(x, FH, x + FH, 0, COL.red, 14); }).join('')),
  'ics-Z': letter([[[0, 0], [FW, 0], COL.yellow], [[FW, 0], [FW, FH], COL.blue], [[FW, FH], [0, FH], COL.red], [[0, FH], [0, 0], COL.black]]
    .map(([a, b, f]) => P([a, b, [FW / 2, FH / 2]], f)).join('')),

  'ics-AP': pennant([0, 1, 2, 3, 4].map(i => R(i * PW / 5, 0, PW / 5 + .5, PH, i % 2 ? COL.white : COL.red)).join('')),
  'num-1': pennant(R(0, 0, PW, PH, COL.white) + C(PH * .55, PH / 2, PH * .26, COL.red)),
  'num-2': pennant(R(0, 0, PW, PH, COL.blue) + C(PH * .55, PH / 2, PH * .26, COL.white)),
  'num-3': pennant(R(0, 0, PW / 3, PH, COL.red) + R(PW / 3, 0, PW / 3, PH, COL.white) + R(PW * 2 / 3, 0, PW / 3, PH, COL.blue)),
  'num-4': pennant(pCross(COL.red, COL.white)),
  'num-5': pennant(R(0, 0, PW / 2, PH, COL.yellow) + R(PW / 2, 0, PW / 2, PH, COL.blue)),
  'num-6': pennant(R(0, 0, PW, PH / 2, COL.black) + R(0, PH / 2, PW, PH / 2, COL.white)),
  'num-7': pennant(R(0, 0, PW, PH / 2, COL.yellow) + R(0, PH / 2, PW, PH / 2, COL.red)),
  'num-8': pennant(pCross(COL.white, COL.red)),
  'num-9': pennant(R(0, 0, PW / 2, PH / 2, COL.white) + R(0, PH / 2, PW / 2, PH / 2, COL.red) + R(PW / 2, 0, PW / 2, PH / 2, COL.black) + R(PW / 2, PH / 2, PW / 2, PH / 2, COL.yellow)),

  'sub-1': { w: 140, h: FH, outline: 'tri', body: R(0, 0, 140, FH, COL.blue) + P([[0, FH * .22], [140 * .56, FH / 2], [0, FH * .78]], COL.yellow) },

  'plain-black': letter(R(0, 0, FW, FH, COL.black)),
  'plain-orange': letter(R(0, 0, FW, FH, COL.orange)),
  'plain-blue': letter(R(0, 0, FW, FH, COL.blue)),
  'plain-yellow': letter(R(0, 0, FW, FH, COL.yellow)),

  'shape-starboard': { w: 84, h: 110, outline: 'peak', staff: false, body: R(0, 0, 84, 110, COL.green) },
  'shape-port': { w: 76, h: 110, outline: 'rect', staff: false, body: R(0, 0, 76, 110, COL.red) },
  'board-minus': { w: 76, h: 110, outline: 'rect', staff: false, body: R(0, 0, 76, 110, COL.white) + R(16, 37, 44, 9, COL.black) },
  'board-plus': { w: 76, h: 110, outline: 'rect', staff: false, body: R(0, 0, 76, 110, COL.white) + R(16, 37, 44, 9, COL.black) + R(33.5, 19, 9, 45, COL.black) },

  class: letter(classMark(COL.white, COL.navy)),
};

// A generic dinghy-sail mark for class and group flags. Not any class's insignia.
function classMark(bg, ink) {
  return R(0, 0, FW, FH, bg) + P([[52, 16], [52, 70], [84, 70]], ink) + P([[46, 24], [46, 70], [28, 70]], ink) + R(30, 76, 60, 7, ink);
}
// Sets expand to several flags drawn side by side or in a grid.
const SETS = {
  'set-groups': ['mark-yellow-black', 'mark-blue-white', 'mark-red-white', 'mark-green-white'],
  'set-fleets3': ['mark-yellow-black', 'mark-blue-white', 'mark-red-white'],
  'set-ilca': ['mark-yellow-red', 'mark-green-red', 'mark-white-red'],
};

function design(id) {
  if (DESIGNS[id]) return DESIGNS[id];
  const m = /^text-([A-Z0-9]{2,4})$/.exec(id);
  if (m) return letter(R(0, 0, FW, FH, COL.white) + `<text x="${FW / 2}" y="${FH / 2 + 12}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="34" fill="${COL.black}">${m[1]}</text>`);
  const k = /^mark-(\w+)-(\w+)$/.exec(id);
  if (k && COL[k[1]] && COL[k[2]]) return letter(classMark(COL[k[1]], COL[k[2]]));
  return null;
}

/* ---------------- rendering ---------------- */
let uid = 0;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// One flag at (x, y), clipped to its outline, with a thin edge and (optionally) its halyard.
function piece(d, x, y) {
  const id = `fa${++uid}`, path = outlines[d.outline](d.w, d.h);
  const staff = d.staff === false ? '' : `<line x1="${x - 5}" y1="${y - 6}" x2="${x - 5}" y2="${y + d.h + 6}" stroke="${EDGE}" stroke-width="2.5" stroke-linecap="round"/>`;
  return `${staff}<g transform="translate(${x} ${y})"><clipPath id="${id}"><path d="${path}"/></clipPath>` +
    `<g clip-path="url(#${id})">${d.body}</g><path d="${path}" fill="none" stroke="${EDGE}" stroke-width="1.5" stroke-linejoin="round"/></g>`;
}

// Expand set-* ids into their member flags.
const expand = ids => ids.flatMap(id => SETS[id] || [id]);

/**
 * signalSVG(['ics-AP', 'ics-H'], { label, layout })
 * layout: 'stack' (one over the other, the default), 'side' (side by side) or 'grid' (2 columns).
 * Returns an SVG string with role="img" and the label as its accessible name.
 */
export function signalSVG(ids, { label = '', layout = 'stack', className = 'flag-svg' } = {}) {
  const list = expand([].concat(ids));
  if (list.length > 2 && layout === 'stack') layout = 'grid';
  const ds = list.map(design).filter(Boolean);
  if (!ds.length) return '';
  const pad = 10, gap = 14;
  let out = '', w = 0, h = 0;
  if (layout === 'side') {
    let x = pad;
    for (const d of ds) { out += piece(d, x, pad); x += d.w + gap + (d.staff === false ? 0 : 8); h = Math.max(h, d.h); }
    w = x - gap + pad; h += pad * 2;
  } else if (layout === 'grid') {
    const cw = Math.max(...ds.map(d => d.w)), ch = Math.max(...ds.map(d => d.h));
    ds.forEach((d, i) => { out += piece(d, pad + 8 + (i % 2) * (cw + gap + 8), pad + ((i / 2) | 0) * (ch + gap)); });
    w = pad * 2 + 8 + cw * 2 + gap + 8; h = pad * 2 + Math.ceil(ds.length / 2) * (ch + gap) - gap;
  } else {
    let y = pad;
    for (const d of ds) { out += piece(d, pad + 8, y); y += d.h + 8; w = Math.max(w, d.w); }
    w += pad * 2 + 8; h = y - 8 + pad;
  }
  // without a label the drawing is decorative (the name is shown next to it)
  const a11y = label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true" focusable="false"';
  return `<svg class="${className}" viewBox="0 0 ${w} ${h}" ${a11y} xmlns="http://www.w3.org/2000/svg">${label ? `<title>${esc(label)}</title>` : ''}${out}</svg>`;
}

// Natural size of one art id (for placing flags in illustrations).
export function artSize(id) { const d = design(id); return d ? { w: d.w, h: d.h } : null; }

// A single flag as an SVG <g> placed at (x, y) and scaled to height `hgt`, for use inside a bigger SVG.
export function flagGroup(id, x, y, hgt) {
  const d = design(id); if (!d) return '';
  const k = hgt / d.h;
  return `<g transform="translate(${x} ${y}) scale(${k})">${piece({ ...d, staff: false }, 0, 0)}</g>`;
}

export const FLAG_COLOURS = COL;
