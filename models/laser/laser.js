// ILCA 6 — procedural 3D model of the ILCA dinghy (formerly Laser Radial) with the ILCA 6 rig.
// Dimensions follow the ILCA Class Rules 2026 and the Measurement Diagrams (rules pp. 33–40):
// top mast ≤ 3600 with the collar 305 from its foot, ILCA 6 lower ≤ 2262 with the gooseneck 945 above
// the heel, boom ≤ 2740 with its fittings, ILCA 6 sail (luff 4560, leech 5010, three battens),
// centreboard chord 341, rudder chord 203, fitting positions from the hull plan on p. 33.
// The hull lines (Construction Manual) are not public: they are smooth curves fitted to the published
// length and beam, the fitting positions and photos. Numbers and sources: .claude/memory/ilca-model.md.
//
// Units: metres. Hull lines use xa = distance forward of the transom and zb = height above the
// lowest point of the keel. World: +x bow, +y up (0 = waterline), +z starboard.
import * as THREE from 'three';
import {
  V3, UP, clamp, smooth, deg, rnd, mono, gridGeo, sweep, cylBetween, roundRect,
  canvasTex, ropeMat, tube, polyCurve, clearGroup,
} from '../../assets/js/explorer/geometry.js';
import { windAngleFromBoom } from '../../assets/js/core/sailing.js';

const SAIL_LETTERS = 'BUL', SAIL_NUMBER = '2026';

// Rig variants. Only the lower mast and the sail change (class rules Part Four, diagrams pp. 35–39).
// Lower-mast diameters are not in the rules: ≈ 65 mm (ILCA 7) from published studies, ILCA 6/4 smaller.
export const RIGS = {
  ilca7: { lower: 2.865, lowerR: .0325, leech: 5.57, roach: .09 },
  ilca6: { lower: 2.262, lowerR: .0285, leech: 5.01, roach: .08 },
  ilca4: { lower: 1.810, lowerR: .0285, leech: 4.54, roach: .07, preBend: 5 },   // rule 30(f): ≈ 5° aft pre-bend (not modelled yet)
};

export function createLaser({ registry, rig = 'ilca6' }) {
  const { reg, add, adopt, offsetOf, PART } = registry;
  const RIG = RIGS[rig];

  /* ---------------- hull lines ---------------- */
  const L = 4.23, XOFF = L / 2;   // LOA 4.23 m; origin amidships
  const zk = mono([[0, .075], [.4, .05], [.9, .026], [1.5, .007], [2.0, 0], [2.5, .004], [3.0, .02], [3.3, .038], [3.55, .058], [3.72, .08], [3.84, .11], [3.95, .175], [4.1, .3], [4.23, .41]]);   // straight raked stem above a round forefoot   // keel / rocker
  const zs = mono([[0, .365], [.8, .37], [1.6, .38], [2.4, .395], [3.1, .415], [3.7, .44], [4.23, .465]]);   // deck edge (sheer)
  const crown = mono([[0, .022], [.8, .03], [1.6, .04], [2.4, .053], [3.0, .06], [3.6, .05], [4.0, .035], [4.23, .015]]);   // deck camber at the centreline
  const hd = mono([[0, .535], [.45, .6], [.9, .648], [1.35, .68], [1.75, .695], [2.15, .688], [2.55, .655], [2.95, .58], [3.3, .475], [3.6, .372], [3.9, .255], [4.1, .15], [4.2, .07], [4.23, .03]]);   // deck half-breadth (beam 1.39)
  const cB = mono([[0, .47], [.5, .525], [1.0, .555], [1.6, .565], [2.2, .548], [2.8, .485], [3.3, .37], [3.7, .24], [4.0, .12], [4.23, .01]]);   // chine half-breadth
  const drA = mono([[0, 3], [1, 4], [2, 7], [2.7, 11], [3.3, 19], [3.8, 28], [4.23, 34]]);   // bottom deadrise, degrees
  const rbF = mono([[0, .06], [1, .085], [2, .1], [3, .13], [3.6, .14], [4.23, .03]]);   // soft-chine fillet
  const RG = .032;   // deck-edge radius
  const deckY = (xa, z) => { const q = clamp(Math.abs(z) / hd(xa), 0, 1); return zs(xa) + crown(xa) * (1 - q * q); };

  const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const bez2 = (a, c, b, t) => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
  const unit2 = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-9; return [dx / l, dy / l, l]; };

  // Half section at xa as [half-breadth, height] points: keel → V bottom → soft chine → flared
  // topside → rounded deck edge → deck tangent. Fixed point counts so the sections loft into a grid.
  const NB = 4, NC = 7, NT = 6, NG = 6, NSEC = NB + NC + NT + NG + 1;
  function section(xa) {
    const k = zk(xa), c = Math.max(cB(xa), .004), h = hd(xa), s = zs(xa), d = deg(drA(xa));
    const P0 = [0, k], C = [c, Math.min(k + c * Math.tan(d), s - .03)], D = [h, s];
    const [bx, by, lb] = unit2(P0, C), [tx, ty, lt] = unit2(C, D);
    const a = Math.min(rbF(xa), .45 * lb, .45 * lt);
    const C1 = [C[0] - bx * a, C[1] - by * a], C2 = [C[0] + tx * a, C[1] + ty * a];
    const g = Math.min(RG, .4 * lt, .45 * h);
    const D1 = [D[0] - tx * g, D[1] - ty * g], B = [h - g, deckY(xa, h - g)];
    const p = [];
    for (let i = 0; i < NB; i++) p.push(lerp2(P0, C1, i / NB));
    for (let i = 0; i < NC; i++) p.push(bez2(C1, C, C2, i / NC));
    for (let i = 0; i < NT; i++) p.push(lerp2(C2, D1, i / NT));
    for (let i = 0; i <= NG; i++) p.push(bez2(D1, D, B, i / NG));
    p.g = g;
    return p;
  }
  // Half-breadth of the hull at xa and height zb (outside skin).
  function sideHalf(xa, zb) {
    const p = section(xa); if (zb <= p[0][1]) return 0;
    for (let k = 0; k < p.length - 1; k++) { const [z0, y0] = p[k], [z1, y1] = p[k + 1]; if (y1 >= zb) return z0 + (z1 - z0) * (zb - y0) / ((y1 - y0) || 1e-9); }
    return p[p.length - 1][0];
  }
  // Displaced volume below height h, from the section areas.
  function areaBelow(xa, h) {
    const p = section(xa); let A = 0;
    for (let k = 0; k < p.length - 1; k++) {
      const [z0, y0] = p[k]; let [z1, y1] = p[k + 1];
      if (y0 >= h) break;
      const cut = y1 > h; if (cut) { z1 = z0 + (z1 - z0) * (h - y0) / (y1 - y0); y1 = h; }
      A += (z1 - z0) * (h - (y0 + y1) / 2);
      if (cut) break;
    }
    return 2 * A;
  }
  const volumeBelow = h => { let v = 0; const n = 140; for (let i = 0; i < n; i++) v += areaBelow((i + .5) / n * L, h) * L / n; return v; };

  // Static waterline: boat ready to sail (hull 59 kg + rig ≈ 10 + foils ≈ 6) with a 60 kg sailor, in sea water.
  const SAILING_MASS = 135, DISP = SAILING_MASS / 1025;
  const WL = (() => { let lo = .02, hi = .3; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (volumeBelow(m) < DISP) lo = m; else hi = m; } return (lo + hi) / 2; })();
  const X = xa => xa - XOFF, Y = zb => zb - WL;

  /* ---------------- deck plan: cockpit, trunk well, mast hole ---------------- */
  // Diagram p.33 (from the transom): cockpit aft end 684–796, well apex 2426–2538, mast 2903–2947,
  // bow eye 3848–3961. The slot sits in a well that slopes down aft into the cockpit (board diagram p.34).
  const CK = { a: .74, f: 2.09, w: .30, rc: .07, rf: .1, ins: .025 };
  const LE_X = 2.49, LE_Y = .42, WELL_A = deg(16), RAKE = deg(15);   // board LE meets the well 420 above the keel line
  const WELL = xa => LE_Y + (xa - LE_X) * Math.tan(WELL_A);
  CK.p = (() => { let x = 2.45; while (WELL(x) < deckY(x, 0) && x < 3) x += .001; return x; })();
  const FLOOR = xa => .175 + (xa - CK.a) * .012;   // self-draining: about 85 mm above the waterline
  const SOLE = xa => FLOOR(xa) + (WELL(xa) - FLOOR(xa)) * smooth(CK.f - .075, CK.f + .005, xa);

  const OUT = (() => {   // starboard half of the cockpit outline: aft centre → corner → side → well → apex
    const { a, f, w, rc, rf } = CK, p = CK.p, o = [[a, 0], [a, (w - rc) / 2]];
    for (let k = 0; k <= 8; k++) { const th = Math.PI - k / 8 * Math.PI / 2; o.push([a + rc + rc * Math.cos(th), w - rc + rc * Math.sin(th)]); }
    for (let x = a + rc + .1; x < f - rf - .03; x += .1) o.push([x, w]);
    const dl = Math.hypot(p - f, w), dv = [(p - f) / dl, -w / dl];
    const c0 = [f - rf, w], c2 = [f + dv[0] * rf, w + dv[1] * rf];
    for (let k = 0; k <= 6; k++) o.push(bez2(c0, [f, w], c2, k / 6));
    const n = Math.ceil((dl - rf) / .05); for (let k = 1; k <= n; k++) o.push(lerp2(c2, [p, 0], k / n));
    CK.dv = dv;
    return o;
  })();
  const OUTI = (() => {   // the same outline at the cockpit sole (walls have draft)
    const o = OUT.map((pt, k) => {
      const a = OUT[Math.max(0, k - 1)], b = OUT[Math.min(OUT.length - 1, k + 1)];
      const [tx, tz] = unit2(a, b); return [pt[0] + tz * CK.ins, pt[1] - tx * CK.ins];
    });
    const q = o[o.length - 2], t = -q[1] / CK.dv[1]; o[o.length - 1] = [q[0] + CK.dv[0] * t, 0];
    return o;
  })();
  const interpHalf = (poly, xa) => {
    if (xa < poly[2][0] || xa > poly[poly.length - 1][0]) return 0;
    for (let k = 2; k < poly.length - 1; k++) { const [x0, z0] = poly[k], [x1, z1] = poly[k + 1]; if (xa <= x1) return x1 > x0 ? z0 + (z1 - z0) * (xa - x0) / (x1 - x0) : z1; }
    return 0;
  };
  const cockpitHalf = xa => xa < CK.a ? 0 : interpHalf(OUT, xa);
  const soleHalf = xa => interpHalf(OUTI, xa);

  const MX = 2.95, R_HOLE = .033;   // mast tube centre
  const mastHalf = xa => Math.abs(xa - MX) < R_HOLE ? Math.sqrt(R_HOLE * R_HOLE - (xa - MX) ** 2) : 0;
  // Slot for the centreboard in the well: from the trailing to the leading edge crossing (+ clearance).
  const S0 = 2.098, S1 = 2.502, SW = .018;
  const slotHalf = xa => {
    if (xa < S0 || xa > S1) return 0;
    if (xa < S0 + SW) return Math.sqrt(Math.max(0, SW * SW - (S0 + SW - xa) ** 2));
    if (xa > S1 - SW) return Math.sqrt(Math.max(0, SW * SW - (xa - S1 + SW) ** 2));
    return SW;
  };

  /* ---------------- materials ---------------- */
  const noiseTex = canvasTex(256, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 110 + rnd() * 145; im.data.set([v, v, v, 255], i * 4); }
    g.putImageData(im, 0, 0);
  }, false);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.repeat.set(30, 30);
  const MAT = {
    paint: new THREE.MeshPhysicalMaterial({ color: '#f4f4ef', roughness: .32, clearcoat: .75, clearcoatRoughness: .2, side: THREE.DoubleSide }),   // inside shows when the deck explodes off
    deck: new THREE.MeshPhysicalMaterial({ color: '#f1f2ee', roughness: .62, clearcoat: .25, bumpMap: noiseTex, bumpScale: .0016 }),
    sole: new THREE.MeshStandardMaterial({ color: '#e6e9e6', roughness: .85, bumpMap: noiseTex, bumpScale: .002 }),
    wall: new THREE.MeshPhysicalMaterial({ color: '#eceeea', roughness: .45, clearcoat: .3 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a3036', roughness: .8, side: THREE.DoubleSide }),
    alu: new THREE.MeshStandardMaterial({ color: '#d3d9df', metalness: .9, roughness: .28 }),
    spar: new THREE.MeshStandardMaterial({ color: '#c9d0d6', metalness: .85, roughness: .32 }),
    steel: new THREE.MeshStandardMaterial({ color: '#e8ecef', metalness: 1, roughness: .18 }),
    black: new THREE.MeshStandardMaterial({ color: '#1c2026', roughness: .55 }),
    grey: new THREE.MeshStandardMaterial({ color: '#59626c', roughness: .6 }),
    foil: new THREE.MeshPhysicalMaterial({ color: '#f6f7f5', roughness: .26, clearcoat: .5 }),
    strap: new THREE.MeshStandardMaterial({ color: '#2b323d', roughness: .85 }),
    pad: new THREE.MeshStandardMaterial({ color: '#1d417d', roughness: .75 }),
    red: new THREE.MeshStandardMaterial({ color: '#d0312d', roughness: .5 }),
    cloth: new THREE.MeshStandardMaterial({ color: '#f3f3ee', roughness: .8 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: .18, roughness: .05 }),
  };
  MAT.paint.userData.paint = true;
  const ROPE = {
    main: ropeMat('#1f4f9e', '#f1f3f5'), vang: ropeMat('#c62f2f', '#f4f4f4'), cunningham: ropeMat('#2f8a4f', '#f4f4f4'),
    outhaul: ropeMat('#e7b416', '#2a2a2a'), traveller: ropeMat('#f2f2ee', '#8a96a3'), tie: ropeMat('#f2f2ee', '#c9c9c2'),
    elastic: ropeMat('#191c20', '#353b44'), downhaul: ropeMat('#7a8794', '#e9edf0'), handle: ropeMat('#ff7a33', '#2a2a2a'),
  };

  const boat = new THREE.Group();
  const swing = new THREE.Group();   // the mast, boom, sail and vang turn together round the mast axis
  registry.setPivot(swing);

  /* ---------------- hull, deck, transom ---------------- */
  const XS = (() => {   // stations: even spacing, finer at the bow, plus every deck-plan feature
    const s = [];
    for (let x = 0; x < 3.9; x += .06) s.push(x);
    for (let x = 3.9; x < L; x += .018) s.push(x);
    s.push(L, CK.a - 1e-4, MX - R_HOLE - 1e-4, MX + R_HOLE + 1e-4);
    OUT.forEach(([x]) => s.push(x));
    for (let k = 0; k <= 16; k++) s.push(MX - R_HOLE * Math.cos(Math.PI * k / 16));
    s.sort((a, b) => a - b);
    return s.filter((x, i) => i === 0 || x - s[i - 1] > 2e-5);
  })();
  const SEC = XS.map(section);
  const NX = XS.length - 1;
  for (const side of [1, -1]) {
    add(boat, 'hull', new THREE.Mesh(gridGeo(NX, NSEC - 1, (s, t) => {
      const i = Math.round(s * NX), p = SEC[i][Math.round(t * (NSEC - 1))]; return [X(XS[i]), Y(p[1]), side * p[0]];
    }, [0, -.4, side]), MAT.paint));
  }
  // Deck: from the cockpit / mast-hole edge out to the deck-edge tangent, on the cambered deck surface.
  const DW = XS.map(x => Math.max(cockpitHalf(x), mastHalf(x))), DE = XS.map((x, i) => hd(x) - SEC[i].g);
  for (const side of [1, -1]) {
    add(boat, 'deck', new THREE.Mesh(gridGeo(NX, 10, (s, t) => {
      const i = Math.round(s * NX), w = Math.min(DW[i], DE[i]), z = w + (DE[i] - w) * t;
      return [X(XS[i]), Y(deckY(XS[i], z)), side * z];
    }, [0, 1, 0]), MAT.deck));
  }
  // Flat end caps (transom, bow tip) from the end sections.
  function capGeo(xa, normalX) {
    const p = SEC[xa > 1 ? NX : 0], h = hd(xa), e = h - p.g, c = [];
    p.forEach(([z, y]) => c.push(new THREE.Vector2(z, y)));
    for (let j = 1; j < 10; j++) { const z = e * (1 - 2 * j / 10); c.push(new THREE.Vector2(z, deckY(xa, z))); }
    for (let k = p.length - 1; k > 0; k--) c.push(new THREE.Vector2(-p[k][0], p[k][1]));
    const tri = THREE.ShapeUtils.triangulateShape(c, []), pos = [];
    for (const f of tri) {
      const [a, b, d] = f.map(i => c[i]);
      const cross = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);   // (z, y) plane: +cross faces −x
      const order = (cross > 0) === (normalX < 0) ? [a, b, d] : [a, d, b];
      for (const v of order) pos.push(X(xa), Y(v.y), v.x);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    return g;
  }
  add(boat, 'transom', new THREE.Mesh(capGeo(0, -1), MAT.paint));
  add(boat, 'hull', new THREE.Mesh(capGeo(L, 1), MAT.paint));

  /* ---------------- cockpit and trunk well ---------------- */
  {
    const g = new THREE.Group(), n = OUT.length - 1;
    for (const side of [1, -1]) {
      g.add(new THREE.Mesh(gridGeo(n, 4, (s, t) => {   // walls
        const k = Math.round(s * n), [x0, z0] = OUT[k], [x1, z1] = OUTI[k], y0 = deckY(x0, z0), y1 = SOLE(x1);
        return [X(x0 + (x1 - x0) * t), Y(y0 + (y1 - y0) * t), side * (z0 + (z1 - z0) * t)];
      }, [1, 0, 0]), MAT.wall));   // hint: the first column is the aft wall, facing forward
      const rows = [];   // sole: floor, the step up at the front, then the well with the slot
      for (let x = OUTI[2][0]; x < OUTI[n][0]; x += .035) rows.push(x);
      for (let x = CK.f - .08; x < CK.f + .01; x += .008) rows.push(x);
      for (let k = 0; k <= 8; k++) rows.push(S0 + SW * (1 - Math.cos(Math.PI / 2 * k / 8)), S1 - SW * (1 - Math.cos(Math.PI / 2 * k / 8)));
      OUTI.slice(2).forEach(([x]) => rows.push(x)); rows.push(S0 - 1e-4, S1 + 1e-4);
      rows.sort((a, b) => a - b);
      const R = rows.filter((x, i) => x >= OUTI[2][0] && x <= OUTI[n][0] && (i === 0 || x - rows[i - 1] > 2e-5)), nr = R.length - 1;
      g.add(new THREE.Mesh(gridGeo(nr, 8, (s, t) => {
        const x = R[Math.round(s * nr)], o = soleHalf(x), i0 = Math.min(slotHalf(x), o), z = i0 + (o - i0) * t;
        return [X(x), Y(SOLE(x)), side * z];
      }, [0, 1, 0]), MAT.sole));
    }
    // moulded lip round the cockpit edge, and a small cove where the walls meet the sole
    const loop = (poly, yf) => [...poly, ...poly.slice(1, -1).reverse().map(([x, z]) => [x, -z])].map(([x, z]) => new V3(X(x), Y(yf(x, z)), z));
    g.add(new THREE.Mesh(sweep(loop(OUT, deckY), [[.006, .0005], [0, .0045], [-.008, .003], [-.013, -.004], [-.014, -.018], [-.004, -.016], [.003, -.006]], true), MAT.wall));
    g.add(new THREE.Mesh(sweep(loop(OUTI, x => SOLE(x)), [[.004, -.003], [.004, .016], [0, .006], [-.006, .0005], [-.016, -.003]], true), MAT.wall));
    add(boat, 'cockpit', g);
  }
  // Centreboard trunk: dark slot walls under the well, a rubber rim and the centreboard brake (position B).
  {
    const g = new THREE.Group(), pts = [];
    for (let k = 0; k <= 10; k++) { const a = Math.PI / 2 + Math.PI * k / 10; pts.push([S1 - SW + SW * Math.cos(a - Math.PI), SW * Math.sin(a - Math.PI)]); }
    for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + Math.PI * k / 10; pts.push([S0 + SW - SW * Math.cos(a), -SW * Math.sin(a)]); }
    const ring = pts.map(([x, z]) => [x, z]), n = ring.length;
    g.add(new THREE.Mesh(gridGeo(n, 1, (s, t) => { const [x, z] = ring[Math.round(s * n) % n]; return [X(x), Y(SOLE(x) - .002 - t * .27), z]; }), MAT.dark));
    g.add(new THREE.Mesh(sweep(ring.map(([x, z]) => new V3(X(x), Y(SOLE(x)) + .001, z)), [[.004, 0], [.004, .003], [-.002, .004], [-.004, 0], [-.002, -.002]], true), MAT.black));
    const brake = new THREE.Mesh(new THREE.BoxGeometry(.05, .016, .08), MAT.black);
    brake.position.set(X(S0 - .035), Y(SOLE(S0 - .035)) + .006, 0); brake.rotation.z = -WELL_A * .3; g.add(brake);
    for (const z of [-.028, .028]) { const sc = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .004, 10), MAT.steel); sc.position.set(X(S0 - .035), Y(SOLE(S0 - .035)) + .015, z); g.add(sc); }
    add(boat, 'daggerboardTrunk', g);
  }
  // Mast step: a tube moulded through the foredeck; the heel sits at the bottom.
  const DECK_M = deckY(MX, 0), HEEL = .055;
  {
    const g = new THREE.Group(), depth = DECK_M - HEEL;
    const tubeM = new THREE.Mesh(new THREE.CylinderGeometry(R_HOLE, R_HOLE, depth, 28, 1, true), MAT.dark); tubeM.position.set(X(MX), Y(HEEL) + depth / 2, 0); g.add(tubeM);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(R_HOLE + .003, .004, 8, 32), MAT.wall); lip.rotation.x = Math.PI / 2; lip.position.set(X(MX), Y(DECK_M) - .001, 0); g.add(lip);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(R_HOLE - .0015, R_HOLE - .0015, .012, 28, 1, true), MAT.black); col.position.set(X(MX), Y(DECK_M) + .002, 0); g.add(col);   // rule 19(a): abrasion collar ≤ 10 mm above deck
    add(boat, 'mastStep', g);
  }

  /* ---------------- deck fittings ---------------- */
  const onDeck = (xa, z, lift = 0) => new V3(X(xa), Y(deckY(xa, z)) + lift, z);
  function block(r, mat = MAT.black, w = .014) {
    const g = new THREE.Group();
    for (const z of [-w / 2, w / 2]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .003, 20), mat); ch.rotation.x = Math.PI / 2; ch.position.z = z; g.add(ch); }
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(r * .78, r * .78, w - .003, 20), MAT.alu); sh.rotation.x = Math.PI / 2; g.add(sh);
    const sk = new THREE.Mesh(new THREE.TorusGeometry(r * .45, .0025, 6, 14), MAT.steel); sk.position.y = r + .006; g.add(sk);
    return g;
  }
  function eyeStrap(len = .03) {
    const g = new THREE.Group();
    const arc = new THREE.Mesh(new THREE.TorusGeometry(len / 2.4, .0028, 6, 16, Math.PI), MAT.steel); g.add(arc);
    for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(.012, .002, .012), MAT.steel); f.position.set(s * (len / 2.4 + .004), .001, 0); g.add(f); }
    return g;
  }
  // Bow eye (diagram p.33: 3848–3961 from the transom).
  const BOW_EYE = 3.9;
  {
    const g = new THREE.Group(), p = onDeck(BOW_EYE, 0);
    const e = eyeStrap(.04); e.position.copy(p); g.add(e);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.024, .026, .004, 20), MAT.steel); plate.scale.z = .6; plate.position.copy(p).add(new V3(0, .001, 0)); g.add(plate);
    add(boat, 'bowEye', g);
  }
  // Deck block fitting in the cunningham-fairlead position just aft of the mast, with two blocks:
  // port = cunningham, starboard = outhaul (rule 3(b)viii).
  const DB_X = 2.862, DECK_BLK = { port: null, stbd: null };
  {
    const g = new THREE.Group(), p = onDeck(DB_X, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.05, .01, .07), MAT.black); base.position.copy(p).add(new V3(0, .005, 0)); g.add(base);
    for (const s of [-1, 1]) {
      const b = block(.0125, MAT.black, .011); b.position.copy(p).add(new V3(-.004, .03, s * .02)); b.rotation.z = -.5; g.add(b);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(.006, .007, .018, 10), MAT.strap); sp.position.copy(p).add(new V3(0, .014, s * .02)); g.add(sp);
      DECK_BLK[s < 0 ? 'port' : 'stbd'] = b.position.clone();
    }
    add(boat, 'deckBlock', g);
  }
  // Deck cleat base with two cam cleats (cunningham to port, outhaul to starboard), rule 3(b)viii(c).
  const CL_X = 2.69, CLEAT = { port: null, stbd: null };
  {
    const g = new THREE.Group(), p = onDeck(CL_X, 0);
    const base = new THREE.Mesh(new THREE.BoxGeometry(.075, .01, .1), MAT.black); base.position.copy(p).add(new V3(0, .005, 0)); g.add(base);
    for (const s of [-1, 1]) {
      const c = new THREE.Group(); c.position.copy(p).add(new V3(0, .016, s * .027)); c.rotation.y = s * .25;
      const body = new THREE.Mesh(new THREE.BoxGeometry(.055, .012, .03), MAT.grey); c.add(body);
      for (const z of [-.009, .009]) { const cam = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .012, 12), MAT.black); cam.position.set(.005, .008, z); c.add(cam); }
      const fl = new THREE.Mesh(new THREE.TorusGeometry(.007, .0025, 6, 12), MAT.black); fl.rotation.y = Math.PI / 2; fl.position.set(-.034, .01, 0); c.add(fl);
      g.add(c); CLEAT[s < 0 ? 'port' : 'stbd'] = c.position.clone().add(new V3(0, .01, 0));
    }
    add(boat, 'controlCleats', g);
  }
  // Traveller fairleads (235–290 from the transom, 965–1067 apart) and the traveller clam cleat (diagram p.33).
  const TR_X = .262, TR_Z = .505, TC_X = .6;
  const TR_EYE = [onDeck(TR_X, -TR_Z, .014), onDeck(TR_X, TR_Z, .014)];
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = onDeck(TR_X, s * TR_Z);
      const base = new THREE.Mesh(new THREE.BoxGeometry(.05, .008, .028), MAT.black); base.position.copy(p).add(new V3(0, .004, 0)); g.add(base);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(.011, .004, 8, 16, Math.PI), MAT.black); loop.position.copy(p).add(new V3(0, .006, 0)); g.add(loop);
    }
    const p = onDeck(TC_X, 0);
    const cl = new THREE.Mesh(new THREE.BoxGeometry(.06, .014, .026), MAT.grey); cl.position.copy(p).add(new V3(0, .007, 0)); g.add(cl);
    for (const z of [-.007, .007]) { const j = new THREE.Mesh(new THREE.BoxGeometry(.055, .006, .004), MAT.black); j.position.copy(p).add(new V3(0, .016, z)); g.add(j); }
    add(boat, 'travellerFairleads', g);
  }
  // Transom drain bung.
  {
    const g = new THREE.Group(), p = new V3(X(0) - .003, Y(.29), .2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.014, .003, 8, 20), MAT.grey); ring.rotation.y = Math.PI / 2; ring.position.copy(p); g.add(ring);
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(.011, .012, .016, 16), MAT.black); plug.rotation.z = Math.PI / 2; plug.position.copy(p).add(new V3(-.006, 0, 0)); g.add(plug);
    const tab = new THREE.Mesh(new THREE.BoxGeometry(.006, .02, .006), MAT.black); tab.position.copy(p).add(new V3(-.015, 0, 0)); g.add(tab);
    add(boat, 'drainBung', g);
  }
  // Self-bailer (builder supplied, rule 13) in the aft part of the cockpit sole.
  {
    const g = new THREE.Group(), xa = 1.0, z = .11, y = Y(SOLE(xa));
    const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(-.08, -.035, .08, .035, .03, .03, .03, .03), { depth: .003, bevelEnabled: false }), MAT.grey);
    plate.rotation.x = -Math.PI / 2; plate.position.set(X(xa), y + .001, z); g.add(plate);
    const flap = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(-.05, -.02, .05, .02, .015, .015, .015, .015), { depth: .004, bevelEnabled: false }), MAT.black);
    flap.rotation.x = -Math.PI / 2; flap.position.set(X(xa) - .01, y + .003, z); g.add(flap);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .03, 10), MAT.red); pin.position.set(X(xa) + .055, y + .016, z); g.add(pin);
    add(boat, 'selfBailer', g);
  }
  // Building plaque on the aft face of the cockpit.
  {
    const tex = canvasTex(256, 128, (c, w, h) => {
      c.fillStyle = '#c9ced3'; c.fillRect(0, 0, w, h); c.strokeStyle = '#7e868e'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
      c.fillStyle = '#2b3138'; c.font = '700 64px "Barlow Condensed",Arial,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(SAIL_NUMBER, w / 2, h / 2 + 4);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.08, .04), new THREE.MeshStandardMaterial({ map: tex, metalness: .5, roughness: .35 }));
    const yp = .27, xw = CK.a + CK.ins * (deckY(CK.a, .16) - yp) / (deckY(CK.a, .16) - SOLE(CK.a + CK.ins));
    const hgt = deckY(CK.a, .16) - SOLE(CK.a + CK.ins); m.position.set(X(xw) + .002, Y(yp), -.16); m.lookAt(m.position.clone().add(new V3(hgt, CK.ins, 0)));
    add(boat, 'plaque', m);
  }

  /* ---------------- hiking strap, mainsheet block ---------------- */
  const HS_EYE = .29;   // eye straps on the aft face of the cockpit, 76–138 below the deck
  const aftWallX = y => CK.a + CK.ins * (deckY(CK.a, 0) - y) / (deckY(CK.a, 0) - SOLE(CK.a + CK.ins));
  const MS_X = 1.99;   // mainsheet block on its eye strap at the front of the sole (position A)
  const posR = new V3(X(MS_X), Y(FLOOR(MS_X)) + .14, 0);
  const hsCurve = new THREE.CatmullRomCurve3([[2.0, .012], [1.9, .045], [1.7, .11], [1.45, .175], [1.22, .205], [1.08, .2]].map(([x, h]) => new V3(X(x), Y(FLOOR(x)) + h, 0)), false, 'centripetal');
  {
    const g = new THREE.Group(), pts = hsCurve.getSpacedPoints(40);
    g.add(new THREE.Mesh(sweep(pts, [[-.035, -.006], [.035, -.006], [.038, .002], [.033, .009], [-.033, .009], [-.038, .002]], false), MAT.strap));
    g.add(new THREE.Mesh(sweep(pts.slice(14, 38), [[-.042, -.012], [.042, -.012], [.046, .004], [.038, .016], [-.038, .016], [-.046, .004]], false), MAT.pad));
    add(boat, 'hikingStrap', g);
  }
  {
    const g = new THREE.Group(), end = hsCurve.getPointAt(1), ring = end.clone().add(new V3(-.05, .01, 0));
    const r = new THREE.Mesh(new THREE.TorusGeometry(.012, .003, 6, 16), MAT.steel); r.position.copy(ring); r.rotation.y = Math.PI / 2; g.add(r);
    for (const s of [-1, 1]) {
      const eye = eyeStrap(.022); eye.rotation.z = -Math.PI / 2; eye.position.set(X(aftWallX(HS_EYE)) + .004, Y(HS_EYE), s * .025); g.add(eye);
      g.add(tube([ring.clone().add(new V3(0, 0, s * .006)), new V3(X(aftWallX(HS_EYE)) + .01, Y(HS_EYE), s * .025)], .0025, ROPE.tie, 12));
    }
    g.add(tube([end, ring.clone().add(new V3(.004, .003, 0))], .0035, ROPE.tie, 8));
    // shock cord from the strap up over the aft deck to the traveller cleat (rule 17(d))
    g.add(tube([ring, new V3(X(.95), Y(FLOOR(.95)) + .33, .01), new V3(X(CK.a) - .01, Y(deckY(CK.a, 0)) + .03, .012), onDeck(TC_X + .03, .012, .012)], .003, ROPE.elastic, 30));
    add(boat, 'hikingStrapSupport', g);
  }
  const ratchet = new THREE.Group();
  {
    const fy = Y(FLOOR(MS_X));
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.045, .05, .008, 24), MAT.black); plate.scale.z = .75; plate.position.set(posR.x, fy + .004, 0); ratchet.add(plate);
    const es = eyeStrap(.03); es.position.set(posR.x, fy + .008, 0); ratchet.add(es);
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(.013, .016, .095, 16), MAT.strap); spring.position.set(posR.x, fy + .055, 0); ratchet.add(spring);
    const b = block(.03); b.position.copy(posR); b.rotation.z = Math.PI; ratchet.add(b);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.03, .004, 8, 24), MAT.red); band.position.copy(posR); ratchet.add(band);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(.03, .012, .04), MAT.grey); cam.position.copy(posR).add(new V3(-.035, -.02, 0)); ratchet.add(cam);
    add(boat, 'ratchetBlock', ratchet);
  }

  /* ---------------- rudder, tiller, extension ---------------- */
  const PIN_X = X(0) - .028;   // pintle axis, just aft of the transom
  const TIL_Y = Y(.44);
  {
    const g = new THREE.Group();
    for (const zb of [.335, .15]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.005, .055, .045), MAT.steel); plate.position.set(X(0) - .0025, Y(zb), 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.03, .008, .02), MAT.steel); arm.position.set(X(0) - .017, Y(zb) - .015, 0);
      const eye = new THREE.Mesh(new THREE.TorusGeometry(.008, .003, 8, 16), MAT.steel); eye.rotation.x = Math.PI / 2; eye.position.set(PIN_X, Y(zb) - .015, 0);
      g.add(plate, arm, eye);
    }
    add(boat, 'gudgeons', g);
  }
  // Rudder head (stock): a cassette that hangs on the gudgeons and holds the blade and the tiller.
  const HEAD = { top: .465, bot: .07, len: .24 };
  {
    const g = new THREE.Group();
    const prof = [[0, HEAD.bot + .02], [0, HEAD.top - .03], [-.03, HEAD.top], [-.2, HEAD.top], [-HEAD.len, HEAD.top - .06], [-HEAD.len, HEAD.bot + .05], [-HEAD.len + .04, HEAD.bot], [-.02, HEAD.bot]];
    const s = new THREE.Shape(); prof.forEach(([a, zb], i) => i ? s.lineTo(PIN_X - .006 + a, Y(zb)) : s.moveTo(PIN_X - .006 + a, Y(zb)));
    for (const z of [-1, 1]) {
      const cheek = new THREE.ExtrudeGeometry(s, { depth: .006, bevelEnabled: true, bevelThickness: .002, bevelSize: .003, bevelSegments: 2 });
      cheek.translate(0, 0, z > 0 ? .012 : -.018); g.add(new THREE.Mesh(cheek, MAT.alu));   // the blade sits between the cheeks
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(.012, HEAD.top - HEAD.bot - .1, .03), MAT.alu); back.position.set(PIN_X - .006 - HEAD.len + .006, Y((HEAD.top + HEAD.bot) / 2 - .005), 0); g.add(back);
    for (const zb of [.335, .15]) { const pin = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, .045, 10), MAT.steel); pin.position.set(PIN_X, Y(zb) - .005, 0); g.add(pin); const lug = new THREE.Mesh(new THREE.BoxGeometry(.022, .016, .026), MAT.alu); lug.position.set(PIN_X - .006, Y(zb) + .02, 0); g.add(lug); }
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .05, 12), MAT.steel); bolt.rotation.x = Math.PI / 2; bolt.position.set(PIN_X - .05, Y(.2), 0); g.add(bolt);
    const spacer = bolt.clone(); spacer.position.set(PIN_X - .03, Y(HEAD.bot + .03), 0); g.add(spacer);
    add(boat, 'rudderHead', g);
  }
  // Blade: chord 203 (diagram p.34), 12° aft of vertical when fully down (rule 15(d): ≤ 78° to the head).
  const RB = { tilt: deg(12), chord: .203, le: .64 };
  const bladeTop = new V3(PIN_X - .022, Y(.24), 0), bladeDir = new V3(-Math.sin(RB.tilt), -Math.cos(RB.tilt), 0), bladeAft = new V3(-Math.cos(RB.tilt), Math.sin(RB.tilt), 0);
  {
    const le0 = bladeTop, le1 = le0.clone().addScaledVector(bladeDir, RB.le), te0 = le0.clone().addScaledVector(bladeAft, RB.chord);
    const yb = le1.y, te1 = new V3(te0.x - (te0.y - yb) * Math.tan(RB.tilt), yb, 0);
    const s = new THREE.Shape(); const pts = [[te0.x, te0.y], [le0.x, le0.y], [le1.x + .06 * Math.sin(RB.tilt), le1.y + .06]];
    s.moveTo(...pts[0]); s.lineTo(...pts[1]); s.lineTo(...pts[2]);
    s.quadraticCurveTo(le1.x, le1.y, le1.x - .06, le1.y); s.lineTo(te1.x, te1.y); s.lineTo(te0.x, te0.y);
    const geo = new THREE.ExtrudeGeometry(s, { depth: .008, bevelEnabled: true, bevelThickness: .006, bevelSize: .009, bevelSegments: 3, curveSegments: 10 });
    geo.translate(0, 0, -.004);
    add(boat, 'rudder', new THREE.Mesh(geo, MAT.foil));
    RB.hole = le0.clone().addScaledVector(bladeDir, .05).addScaledVector(bladeAft, .03);
  }
  const tStart = new V3(PIN_X - .19, TIL_Y, 0), tEnd = new V3(X(.98), TIL_Y, 0);
  {
    const g = new THREE.Group();
    g.add(cylBetween(tStart, tEnd, .0135, MAT.alu, 20));
    const wear = cylBetween(new V3(X(TR_X - .1), TIL_Y, 0), new V3(X(TR_X + .1), TIL_Y, 0), .015, MAT.black, 20); g.add(wear);   // rule 16(b) anti-wear tube where the traveller crosses
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.015, 14, 10), MAT.black); cap.position.copy(tEnd); g.add(cap);
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(.05, .014, .016), MAT.black); cleat.position.set(X(.18), TIL_Y + .018, 0); g.add(cleat);   // rule 16(a)ii: downhaul cleat
    add(boat, 'tiller', g);
  }
  {
    const eg = new THREE.Group(), dir = new V3(.72, .3, .62).normalize();
    const j0 = tEnd.clone().add(new V3(-.01, .022, 0)), eEnd = j0.clone().addScaledVector(dir, .9);
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(.013, .013, .05, 14), MAT.black); joint.position.copy(j0); joint.quaternion.setFromUnitVectors(UP, dir);
    eg.add(joint, cylBetween(j0, eEnd, .0095, MAT.alu), cylBetween(j0.clone().addScaledVector(dir, .55), eEnd, .0145, MAT.black));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.018, 14, 10), MAT.black); knob.position.copy(eEnd); eg.add(knob);
    add(boat, 'tillerExtension', eg);
  }
  {
    const g = new THREE.Group(), front = new V3(PIN_X - .01, Y(HEAD.top) + .005, .012);
    g.add(tube([RB.hole.clone().add(new V3(0, 0, .013)), new V3(PIN_X - .012, Y(.3), .016), front, new V3(X(.08), TIL_Y + .02, .012), new V3(X(.17), TIL_Y + .024, .006)], .0022, ROPE.downhaul, 40));
    g.add(tube([new V3(X(.2), TIL_Y + .022, 0), new V3(X(.26), TIL_Y - .02, .02), new V3(X(.3), TIL_Y - .06, .03)], .0022, ROPE.downhaul, 12));
    add(boat, 'rudderDownhaul', g);
  }

  /* ---------------- centreboard (diagram p.34): chord 341, 815 along the trailing edge below the keel line ---------------- */
  const YK = zk(2.3);   // keel line at the trunk
  const LEx = zb => LE_X + (zb - LE_Y) * Math.tan(RAKE), CH = .341 / Math.cos(RAKE), TEx = zb => LEx(zb) - CH;
  const DB_BOT = YK - .815 * Math.cos(RAKE);   // = 787 mm below the hull: the published "draft 0.787 m"
  const DB = { teTop: YK + .372, leTop: YK + .433 };
  {
    const g = new THREE.Group(), s = new THREE.Shape(), r = .06;
    s.moveTo(X(TEx(DB_BOT)), Y(DB_BOT)); s.lineTo(X(LEx(DB_BOT)) - r, Y(DB_BOT));
    s.quadraticCurveTo(X(LEx(DB_BOT)), Y(DB_BOT), X(LEx(DB_BOT + r)), Y(DB_BOT + r));
    s.lineTo(X(LEx(DB.leTop)), Y(DB.leTop)); s.lineTo(X(LEx(DB.leTop)) - .08, Y(DB.leTop)); s.lineTo(X(TEx(DB.teTop)), Y(DB.teTop)); s.lineTo(X(TEx(DB_BOT)), Y(DB_BOT));
    const geo = new THREE.ExtrudeGeometry(s, { depth: .012, bevelEnabled: true, bevelThickness: .01, bevelSize: .012, bevelSegments: 3, curveSegments: 10 });
    geo.translate(0, 0, -.006); g.add(new THREE.Mesh(geo, MAT.foil));
    const stop = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .06, 14), MAT.black); stop.rotation.x = Math.PI / 2; stop.position.set(X(TEx(DB.teTop - .03)) + .045, Y(DB.teTop - .03), 0); g.add(stop);   // stopper rests on the trunk
    const hp = [X(LEx(DB.leTop)) - .05, X(LEx(DB.leTop)) - .14].map(x => new V3(x, Y(DB.leTop - .035), 0));
    g.add(tube([hp[0].clone().add(new V3(0, 0, .02)), hp[0].clone().add(new V3(-.01, .07, .025)), hp[1].clone().add(new V3(.01, .07, .025)), hp[1].clone().add(new V3(0, 0, .02))], .004, ROPE.handle, 24));   // rule 14(a) rope handle
    g.add(tube([hp[0].clone().add(new V3(0, 0, -.02)), hp[0].clone().add(new V3(-.01, .06, -.022)), hp[1].clone().add(new V3(.01, .06, -.022)), hp[1].clone().add(new V3(0, 0, -.02))], .004, ROPE.handle, 24));
    add(boat, 'daggerboard', g);
  }
  // Shock cord from the hole in the board's top forward corner to the bow eye (rule 14(f)).
  {
    const g = new THREE.Group(), a = new V3(X(LEx(DB.leTop)) - .02, Y(DB.leTop) - .02, .01);
    g.add(tube([a, onDeck(2.62, .03, .014), onDeck(2.8, .05, .012), onDeck(MX, .052, .012), onDeck(3.3, .035, .01), onDeck(3.7, .015, .01), onDeck(BOW_EYE - .01, .004, .012)], .0032, ROPE.elastic, 60));
    add(boat, 'daggerboardRetainer', g);
  }

  /* ---------------- compass (rule 22: on the deck, fasteners only) ---------------- */
  {
    const g = new THREE.Group(), xa = 2.36, z = -.36, p = onDeck(xa, z), n = new V3(-.55, .83, .12).normalize();
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(.05, .058, .045, 32), MAT.black); housing.position.copy(p).addScaledVector(n, .018); housing.quaternion.setFromUnitVectors(UP, n); g.add(housing);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.062, .066, .02, 32), MAT.black); base.position.copy(p).add(new V3(0, .008, 0)); g.add(base);
    const face = new THREE.Mesh(new THREE.CircleGeometry(.042, 32), new THREE.MeshStandardMaterial({ roughness: .2, map: canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#10161c'; c.fillRect(0, 0, w, w); c.strokeStyle = '#e9eef2'; c.lineWidth = 3; c.translate(w / 2, w / 2);
      for (let i = 0; i < 36; i++) { c.rotate(Math.PI / 18); c.beginPath(); c.moveTo(0, -w * .44); c.lineTo(0, -w * (i % 3 === 2 ? .34 : .39)); c.stroke(); }
      c.font = '700 40px "Barlow Condensed",Arial,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff7a33'; c.fillText('N', 0, -w * .2);
    }) }));
    face.position.copy(housing.position).addScaledVector(n, .0235); face.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); g.add(face);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.044, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), MAT.glass);
    dome.position.copy(face.position); dome.quaternion.setFromUnitVectors(UP, n); g.add(dome);
    add(boat, 'compass', g);
  }

  /* ---------------- rig: mast, gooseneck, boom ----------------
     Swing-group frame: origin on the mast axis, −x = aft along the boom, y = world height. */
  const GOOSE = HEEL + .945, TANG = HEEL + .47;   // diagram p.37: gooseneck 945 ± 5, vang tang ≥ 445 above the heel
  const LOWER_TOP = HEEL + RIG.lower, LOWER_R = RIG.lowerR, TOP_R = .025;
  const MAST_TOP = LOWER_TOP - .305 + 3.6;   // top section ≤ 3600 incl. plug, collar 305 ± 5 from its foot (p.34)
  const BOOM_R = .025, BOOM_U0 = LOWER_R + .022, BOOM_END = BOOM_U0 + 2.74;   // boom ≤ 2740 (p.34)
  const yB = Y(GOOSE);
  swing.position.set(X(MX), 0, 0); boat.add(swing);

  // Mast bend: the tip falls aft, in the plane of the boom, more when the sail is sheeted hard.
  const BEND_MIN = .1, BEND_MAX = .34, BEND_REF = .32;
  const trim = { phi: deg(-20), depth: 1, side: -1, twist: 0, bend: BEND_MAX };
  const bendF = zb => { const q = clamp((zb - DECK_M) / (MAST_TOP - DECK_M), 0, 1); return q * q; };
  const mastAt = (zb, bend = trim.bend) => new V3(-bend * bendF(zb), Y(zb), 0);

  const lowerG = new THREE.Group(), topG = new THREE.Group();
  add(swing, 'mastLower', lowerG); add(swing, 'mastTop', topG);
  function buildMast() {
    clearGroup(lowerG); clearGroup(topG);
    const curve = (z0, z1, n) => new THREE.CatmullRomCurve3([...Array(n + 1)].map((_, i) => mastAt(z0 + (z1 - z0) * i / n)));
    lowerG.add(new THREE.Mesh(new THREE.TubeGeometry(curve(HEEL, LOWER_TOP, 10), 24, LOWER_R, 24, false), MAT.spar));
    topG.add(new THREE.Mesh(new THREE.TubeGeometry(curve(LOWER_TOP - .01, MAST_TOP - .02, 16), 40, TOP_R, 20, false), MAT.spar));
    const ringAt = (zb, h, r, mat, grp) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat); m.position.copy(mastAt(zb + h / 2)); grp.add(m); };
    ringAt(HEEL - .002, .04, LOWER_R + .001, MAT.black, lowerG);   // base plug
    ringAt(LOWER_TOP - .002, .03, LOWER_R + .0015, MAT.black, topG);   // top-section collar sitting on the lower
    ringAt(MAST_TOP - .025, .025, TOP_R + .0008, MAT.black, topG);   // top plug
    adopt('mastLower', lowerG); adopt('mastTop', topG);
  }
  {
    // static lower-mast fittings: vang tang and a short cleat for the retention line
    const g = new THREE.Group();
    const tang = new THREE.Mesh(new THREE.BoxGeometry(.03, .045, .006), MAT.steel); tang.position.set(-LOWER_R - .012, Y(TANG), 0); g.add(tang);
    for (const z of [-.006, .006]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, .004, 8), MAT.steel); r.rotation.z = Math.PI / 2; r.position.set(-LOWER_R + .001, Y(TANG) + z * 2, 0); g.add(r); }
    add(swing, 'mastLower', g);
  }
  {
    const g = new THREE.Group();
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(.03, .08, .036), MAT.alu); bracket.position.set(-LOWER_R - .012, yB + .005, 0); g.add(bracket);
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R + .002, BOOM_R + .002, .05, 24), MAT.black); plug.rotation.z = Math.PI / 2; plug.position.set(-BOOM_U0 - .02, yB, 0); g.add(plug);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .065, 10), MAT.steel); bolt.position.set(-LOWER_R - .026, yB, 0); g.add(bolt);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .004, 8), MAT.steel); r.rotation.z = Math.PI / 2; r.position.set(-LOWER_R + .002, yB + s * .025, 0); g.add(r); }
    // outhaul turning block at the gooseneck (rule 3(f)v: ≤ 100 mm from the bolt)
    const ob = block(.011, MAT.black, .01); ob.position.set(-LOWER_R - .02, yB + .045, .022); ob.rotation.y = Math.PI / 2; g.add(ob);
    add(swing, 'gooseneck', g);
  }
  // Boom fittings, measured from the aft end (p.34).
  const U_ABLK = BOOM_END - .071, U_ESTRAP = BOOM_END - 1.047, U_CLEAT = BOOM_END - 1.186, U_FBLK = BOOM_END - 1.653, U_KEY = BOOM_U0 + .44;
  {
    const g = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R, BOOM_R, BOOM_END - BOOM_U0, 28), MAT.spar); tb.rotation.z = Math.PI / 2; tb.position.set(-(BOOM_U0 + BOOM_END) / 2, yB, 0); g.add(tb);
    const end = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R + .0015, BOOM_R + .0015, .03, 24), MAT.black); end.rotation.z = Math.PI / 2; end.position.set(-BOOM_END + .012, yB, 0); g.add(end);
    const fair = new THREE.Mesh(new THREE.BoxGeometry(.025, .014, .022), MAT.black); fair.position.set(-BOOM_END + .03, yB + BOOM_R + .006, 0); g.add(fair);   // outhaul fairlead
    const cl = new THREE.Mesh(new THREE.BoxGeometry(.06, .014, .022), MAT.grey); cl.position.set(-U_CLEAT + .03, yB + BOOM_R + .006, 0); g.add(cl);   // outhaul clam cleat (rule 3(f)viii(b): stays)
    const key = new THREE.Mesh(new THREE.BoxGeometry(.06, .012, .03), MAT.alu); key.position.set(-U_KEY, yB - BOOM_R - .004, 0); g.add(key);   // vang key fitting
    add(swing, 'boom', g);
  }
  const boomBlocks = new THREE.Group();
  {
    for (const u of [U_ABLK, U_FBLK]) {
      const b = block(.022); b.position.set(-u, yB - BOOM_R - .045, 0); b.rotation.z = Math.PI; boomBlocks.add(b);
      boomBlocks.add(cylBetween(new V3(-u, yB - BOOM_R, 0), new V3(-u, yB - BOOM_R - .02, 0), .003, MAT.steel));
      const st = new THREE.Mesh(new THREE.BoxGeometry(.03, .004, .02), MAT.steel); st.position.set(-u, yB - BOOM_R - .001, 0); boomBlocks.add(st);
    }
    const es = eyeStrap(.03); es.rotation.x = Math.PI; es.position.set(-U_ESTRAP, yB - BOOM_R, 0); boomBlocks.add(es);
    add(swing, 'boomBlocks', boomBlocks);
  }

  // Wind indicator on a wand clamped to the front of the lower mast (rule 23); it turns to the wind.
  const vane = new THREE.Group();
  {
    const g = new THREE.Group(), zb = .84, base = new V3(LOWER_R + .004, Y(zb), 0), tip = base.clone().add(new V3(.22, .18, 0));
    const clamp1 = new THREE.Mesh(new THREE.CylinderGeometry(LOWER_R + .003, LOWER_R + .003, .02, 24), MAT.black); clamp1.position.set(0, Y(zb), 0); g.add(clamp1);
    g.add(cylBetween(base, tip, .003, MAT.black));
    vane.position.copy(tip); g.add(vane);
    vane.add(cylBetween(new V3(-.09, 0, 0), new V3(.07, 0, 0), .002, MAT.black));
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.05, .035, .0015), MAT.red); fin.position.set(-.08, .004, 0); vane.add(fin);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.006, 10, 8), MAT.black); vane.add(ball);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(.007, 10, 8), MAT.black); nose.position.x = .07; vane.add(nose);
    add(swing, 'windIndicator', g);
  }

  /* ---------------- sail ----------------
     Sail coordinates: u = distance aft of the mast axis, v = height above the boom.
     Planform from the ILCA 6 diagram (p.37): luff from the tack to the masthead, leech ≈ 5.01 with roach,
     loose foot. The luff follows the bent mast; the cloth is laid out on a reference bend. */
  const SLEEVE_R = LOWER_R + .006, V_T = .1, V_C = .06, V_H = MAST_TOP - GOOSE - .015, FOOT_SAG = .07;
  const U_C = BEND_REF * bendF(GOOSE + V_H) + Math.sqrt((RIG.leech) ** 2 - (V_H - V_C) ** 2);
  function planform(bend) {
    const bu = v => bend * bendF(GOOSE + v) + SLEEVE_R;
    const luff = t => { const v = V_T + (V_H - V_T) * t; return [bu(v), v]; };
    const tack = luff(0), head = luff(1), clew = [U_C, V_C];
    const ld = [head[0] - clew[0], head[1] - clew[1]], ll = Math.hypot(ld[0], ld[1]), lp = [ld[1] / ll, -ld[0] / ll];
    const leech = t => { const r = RIG.roach * Math.pow(Math.sin(Math.PI * t), .9) * (1 - .3 * t); return [clew[0] + ld[0] * t + lp[0] * r, clew[1] + ld[1] * t + lp[1] * r]; };
    const foot = s => [tack[0] + (clew[0] - tack[0]) * s, tack[1] + (clew[1] - tack[1]) * s - FOOT_SAG * Math.sin(Math.PI * s)];
    return { tack, head, clew, luff, leech, foot };
  }
  const coons = (pf, s, t) => {
    const l = pf.luff(t), r = pf.leech(t), f = pf.foot(s);
    return [(1 - s) * l[0] + s * r[0] + (1 - t) * (f[0] - ((1 - s) * pf.tack[0] + s * pf.clew[0])), (1 - s) * l[1] + s * r[1] + (1 - t) * (f[1] - ((1 - s) * pf.tack[1] + s * pf.clew[1]))];
  };
  const REF = planform(BEND_REF);
  const refP = (s, t) => coons(REF, s, t);
  function invRef(u, v) {   // sail coordinates on the reference layout → grid parameters (s, t)
    let s = .5, t = clamp(v / V_H, 0, .98);
    for (let k = 0; k < 30; k++) {
      const p = refP(s, t), e = 1e-4, ps = refP(s + e, t), pt = refP(s, t + e);
      const a = (ps[0] - p[0]) / e, b = (pt[0] - p[0]) / e, c = (ps[1] - p[1]) / e, d = (pt[1] - p[1]) / e, det = a * d - b * c, du = u - p[0], dv = v - p[1];
      s = clamp(s + (d * du - b * dv) / det, -.05, 1.05); t = clamp(t + (-c * du + a * dv) / det, -.05, .995);
    }
    return [s, t];
  }

  const NU = 28, NV = 42, sailGeo = new THREE.BufferGeometry();
  const U0 = -.08, U1 = U_C + .22, V0 = -.12, V1 = V_H + .08;   // texture window in sail coordinates
  {
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3), uv = new Float32Array((NU + 1) * (NV + 1) * 2), idx = [];
    let q = 0;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const [u, v] = refP(i / NU, j / NV); uv[q++] = (u - U0) / (U1 - U0); uv[q++] = (v - V0) / (V1 - V0); }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, d, b, a, c, d); }
    sailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sailGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sailGeo.setIndex(idx);
  }
  // Current layout (follows the mast bend), cached per row / column; refreshed in setTrim.
  let PF = planform(trim.bend);
  const rowL = [], rowR = [], colF = [];
  function refreshPlan() {
    PF = planform(trim.bend);
    for (let j = 0; j <= NV; j++) { rowL[j] = PF.luff(j / NV); rowR[j] = PF.leech(j / NV); }
    for (let i = 0; i <= NU; i++) { const s = i / NU, f = PF.foot(s); colF[i] = [f[0] - ((1 - s) * PF.tack[0] + s * PF.clew[0]), f[1] - ((1 - s) * PF.tack[1] + s * PF.clew[1])]; }
  }
  // Camber: draft about 40 % aft, deepest low-mid; a loose foot keeps some shape; the leech twists open.
  function camber(s, t, chord, time) {
    const prof = s < .4 ? 1 - ((.4 - s) / .4) ** 2 : 1 - ((s - .4) / .6) ** 2;
    const depth = .1 * (.6 + .4 * smooth(0, .35, t)) * (1 - .4 * smooth(.55, 1, t));
    let w = chord * depth * prof * trim.depth * (.55 + .45 * smooth(0, .1, t));
    w += s * chord * Math.tan(trim.twist * Math.pow(t, 1.4));
    w *= trim.side;
    w += Math.sin(time * 8.5 + t * 7 - s * 5) * .016 * s * s * (1 - trim.depth * .8) * smooth(0, .08, t);
    return w;
  }
  function sailXYZ(s, t, time, out) {   // grid parameters → swing-local position
    const l = PF.luff(t), r = PF.leech(t), f = PF.foot(s);
    const u = (1 - s) * l[0] + s * r[0] + (1 - t) * (f[0] - ((1 - s) * PF.tack[0] + s * PF.clew[0]));
    const v = (1 - s) * l[1] + s * r[1] + (1 - t) * (f[1] - ((1 - s) * PF.tack[1] + s * PF.clew[1]));
    return (out || new V3()).set(-u, yB + v, camber(s, t, Math.hypot(r[0] - l[0], r[1] - l[1]), time || 0));
  }
  function updateSailGeo(time) {
    const p = sailGeo.attributes.position;
    for (let j = 0, k = 0; j <= NV; j++) {
      const t = j / NV, l = rowL[j], r = rowR[j], chord = Math.hypot(r[0] - l[0], r[1] - l[1]);
      for (let i = 0; i <= NU; i++, k++) {
        const s = i / NU, f = colF[i];
        const u = (1 - s) * l[0] + s * r[0] + (1 - t) * f[0], v = (1 - s) * l[1] + s * r[1] + (1 - t) * f[1];
        p.setXYZ(k, -u, yB + v, camber(s, t, chord, time));
      }
    }
    p.needsUpdate = true; sailGeo.computeVertexNormals(); sailGeo.computeBoundingSphere(); sailGeo.computeBoundingBox();
  }

  // ---- sail layout on the reference shape: battens, window, numbers (rules 4 and 29(e))
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], addv = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  const norm = a => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
  const POCKETS = [[.25, .63, .6], [.5, .63, .6], [.75, .44, .4]].map(([f, len, bat]) => {   // pockets 620–640 / 430–450, battens ≤ 600 / 400
    const q = REF.leech(f), tg = norm(sub(REF.leech(f + .01), REF.leech(f - .01))), nin = [-tg[1], tg[0]];
    return { q, tg, nin, len, bat, e: addv(q, nin, len) };
  });
  const WINDOW = [[.55, .14], [1.04, .14], [1.04, .325], [.55, .525]];   // base ≤ 495, sides ≤ 385 / 185, square at the base
  // Number rows parallel to the battens. Starboard: numbers' base 400 below the middle pocket, letters' top on
  // the bottom pocket. Port: each row 400 lower. Starboard rows start / port rows end 100 from the leech.
  const NUM_H = .3, CHAR_W = .2, CHAR_GAP = .05;
  const rowAt = (pk, drop) => ({ o: addv(pk.q, pk.tg, -drop), tg: pk.tg, nin: pk.nin });
  const SAILNO = {
    stbd: { number: rowAt(POCKETS[1], .025 + .4), letters: rowAt(POCKETS[0], .025 + NUM_H) },
    port: { number: rowAt(POCKETS[1], .025 + .8), letters: rowAt(POCKETS[0], .025 + NUM_H + .4) },
  };
  const charCentre = (row, k) => addv(addv(row.o, row.nin, .1 + CHAR_W / 2 + k * (CHAR_W + CHAR_GAP)), row.tg, NUM_H / 2);
  const TELLTALES = [.22, .42, .62].map(t => { const l = REF.luff(t); return [l[0] + .3, l[1]]; });

  const TW = 900, TH = Math.round(TW * (V1 - V0) / (U1 - U0));
  const cx = u => (u - U0) / (U1 - U0) * TW, cy = v => (1 - (v - V0) / (V1 - V0)) * TH, cm = m => m / (U1 - U0) * TW;
  function drawSail(g, side) {
    const W = TW, H = TH, N = 40;
    const outline = [...[...Array(N + 1)].map((_, i) => REF.luff(i / N)), ...[...Array(N + 1)].map((_, i) => REF.leech(1 - i / N)), ...[...Array(N)].map((_, i) => REF.foot(1 - i / N))];
    const trace = () => { g.beginPath(); outline.forEach(([u, v], i) => i ? g.lineTo(cx(u), cy(v)) : g.moveTo(cx(u), cy(v))); g.closePath(); };
    const line = (a, b) => { g.beginPath(); g.moveTo(cx(a[0]), cy(a[1])); g.lineTo(cx(b[0]), cy(b[1])); g.stroke(); };
    g.fillStyle = '#f5f5f0'; g.fillRect(0, 0, W, H);
    g.save(); trace(); g.clip();
    for (let i = 0; i < 5200; i++) { g.fillStyle = `rgba(120,120,110,${rnd() * .035})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1); }
    // radial panels (the "Radial" in the old name): a fan from the head over the top, a fan from the clew below
    const MID = .43, mid = s => refP(s, MID);
    const seam = (a, b) => { g.strokeStyle = 'rgba(150,150,140,.55)'; g.lineWidth = 1.2; line(a, b); g.strokeStyle = 'rgba(150,150,140,.3)'; const n = norm([b[1] - a[1], a[0] - b[0]]); line(addv(a, n, .012), addv(b, n, .012)); };
    for (let k = 0; k <= 5; k++) seam(REF.head, mid(k / 5));
    for (let k = 0; k < 12; k++) seam(mid(k / 12), mid((k + 1) / 12));
    for (const t of [.05, .13, .22, .32]) seam(REF.clew, refP(0, t));
    for (const s of [.2, .42, .64]) seam(REF.clew, mid(s));
    for (const s of [.15, .3]) seam(REF.tack, refP(s, .0));
    // corner patches
    const fan = (c, a, b, radii) => {
      for (const r of radii) {
        const a1 = Math.atan2(cy(a[1]) - cy(c[1]), cx(a[0]) - cx(c[0])), a2 = Math.atan2(cy(b[1]) - cy(c[1]), cx(b[0]) - cx(c[0]));
        let sw = a2 - a1; while (sw < 0) sw += Math.PI * 2; const ccw = sw > Math.PI;
        g.fillStyle = 'rgba(70,70,60,.045)'; g.beginPath(); g.moveTo(cx(c[0]), cy(c[1])); g.arc(cx(c[0]), cy(c[1]), cm(r), a1, a2, ccw); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(120,120,110,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(cx(c[0]), cy(c[1]), cm(r) - 3, a1, a2, ccw); g.stroke();
      }
    };
    fan(REF.tack, REF.clew, REF.luff(.2), [.34, .22, .13]); fan(REF.clew, REF.head, REF.tack, [.36, .24, .14]); fan(REF.head, REF.tack, REF.clew, [.4, .26, .14]);
    // window
    g.fillStyle = '#a9bfcc'; g.beginPath(); WINDOW.forEach(([u, v], i) => i ? g.lineTo(cx(u), cy(v)) : g.moveTo(cx(u), cy(v))); g.closePath(); g.fill();
    const wg = g.createLinearGradient(cx(.55), cy(.52), cx(1.04), cy(.14)); wg.addColorStop(0, 'rgba(255,255,255,.35)'); wg.addColorStop(.5, 'rgba(255,255,255,0)'); wg.addColorStop(1, 'rgba(255,255,255,.2)');
    g.fillStyle = wg; g.fill(); g.strokeStyle = '#e8e8e2'; g.lineWidth = cm(.018); g.stroke();
    // batten pockets, patches at the leech end, end caps
    for (const p of POCKETS) {
      g.strokeStyle = '#e6e6df'; g.lineWidth = cm(.05); g.lineCap = 'round'; line(p.q, p.e);
      g.strokeStyle = 'rgba(120,120,110,.5)'; g.lineWidth = 1; for (const o of [-.024, .024]) line(addv(p.q, p.tg, o), addv(p.e, p.tg, o));
      g.strokeStyle = 'rgba(60,60,55,.35)'; g.lineWidth = cm(.012); line(addv(p.q, p.nin, .03), addv(p.q, p.nin, .03 + p.bat));
      for (const r of [.09, .055]) { g.fillStyle = 'rgba(70,70,60,.05)'; g.beginPath(); g.arc(cx(p.q[0]), cy(p.q[1]), cm(r), 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    // edge tapes, the luff-sleeve seam
    g.save(); trace(); g.clip();
    trace(); g.strokeStyle = 'rgba(105,105,95,.55)'; g.lineWidth = cm(.05); g.stroke();
    trace(); g.strokeStyle = '#e5e5de'; g.lineWidth = cm(.046); g.stroke();
    g.strokeStyle = 'rgba(105,105,95,.5)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i <= N; i++) { const [u, v] = REF.luff(i / N); i ? g.lineTo(cx(u + .035), cy(v)) : g.moveTo(cx(u + .035), cy(v)); } g.stroke();
    // sailmaker label + measurement stamp near the tack
    g.fillStyle = '#d9dcdf'; g.fillRect(cx(.16), cy(.27), cm(.17), cm(.05)); g.fillStyle = '#7d8790'; g.fillRect(cx(.175), cy(.26), cm(.1), cm(.008)); g.fillRect(cx(.175), cy(.245), cm(.13), cm(.006));
    g.strokeStyle = 'rgba(40,70,140,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(cx(.4), cy(.24), cm(.028), 0, Math.PI * 2); g.stroke();
    // telltales: red to port, green to starboard
    g.strokeStyle = side === 'port' ? '#d32f2f' : '#1f9d55'; g.lineWidth = 3; g.lineCap = 'round';
    for (const [u, v] of [...TELLTALES, ...POCKETS.slice(1).map(p => addv(p.q, p.nin, .05))]) { g.beginPath(); g.moveTo(cx(u), cy(v)); g.bezierCurveTo(cx(u + .04), cy(v + .01), cx(u + .07), cy(v - .015), cx(u + .11), cy(v - .005)); g.stroke(); }
    g.restore();
    // cringles: tack, cunningham, clew, head
    const eyelet = ([u, v], r = .016) => { g.fillStyle = '#aab1b8'; g.beginPath(); g.arc(cx(u), cy(v), cm(r), 0, Math.PI * 2); g.fill(); g.fillStyle = '#39414a'; g.beginPath(); g.arc(cx(u), cy(v), cm(r * .55), 0, Math.PI * 2); g.fill(); };
    eyelet(addv(REF.tack, [.06, .035])); eyelet(CUNNINGHAM_EYE, .02); eyelet(addv(REF.clew, [-.05, .04]), .02);
    // letters and numbers: this side bold, the other side faintly through the cloth.
    // Seen from starboard the texture is mirrored, so starboard print is drawn mirrored.
    const ang = tg => Math.atan2(tg[0], tg[1]);   // glyph up = tg; glyph right = −nin (toward the leech)
    const glyphs = (str, row, mirror, alpha, fromLeech) => {
      g.save(); g.globalAlpha = alpha; g.fillStyle = '#14202c';
      g.font = `700 ${Math.round(cm(NUM_H) * 1.36)}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      [...str].forEach((ch, i) => {
        const k = fromLeech ? i : str.length - 1 - i, [u, v] = charCentre(row, k);
        g.save(); g.translate(cx(u), cy(v)); g.rotate(ang(row.tg)); g.scale(mirror ? -1 : 1, 1); g.fillText(ch, 0, cm(.012)); g.restore();
      });
      g.restore();
    };
    const me = SAILNO[side], other = SAILNO[side === 'port' ? 'stbd' : 'port'], mirrorMe = side === 'stbd';
    glyphs(SAIL_LETTERS, other.letters, !mirrorMe, .07, side === 'port'); glyphs(SAIL_NUMBER, other.number, !mirrorMe, .07, side === 'port');
    glyphs(SAIL_LETTERS, me.letters, mirrorMe, 1, side === 'stbd'); glyphs(SAIL_NUMBER, me.number, mirrorMe, 1, side === 'stbd');
  }
  const CUNNINGHAM_EYE = [REF.luff(0)[0] + .05, V_T + .14], CE_ST = invRef(...CUNNINGHAM_EYE);
  const sailTex = { port: canvasTex(TW, TH, g => drawSail(g, 'port')), stbd: canvasTex(TW, TH, g => drawSail(g, 'stbd')) };
  const sailMatStbd = new THREE.MeshStandardMaterial({ map: sailTex.stbd, roughness: .78, side: THREE.FrontSide, shadowSide: THREE.DoubleSide });
  const sailMatPort = new THREE.MeshStandardMaterial({ map: sailTex.port, roughness: .78, side: THREE.BackSide, shadowSide: THREE.DoubleSide });
  add(swing, 'sail', new THREE.Mesh(sailGeo, sailMatStbd)); add(swing, 'sail', new THREE.Mesh(sailGeo, sailMatPort), { shadow: false });

  // Luff sleeve: the sail's front edge is a tube that slides over the mast (no halyard, no track).
  const sleeveG = new THREE.Group(); add(swing, 'luffSleeve', sleeveG);
  function buildSleeve() {
    clearGroup(sleeveG);
    const z0 = GOOSE + V_T - .02, z1 = GOOSE + V_H + .012, n = 18;
    const curve = new THREE.CatmullRomCurve3([...Array(n + 1)].map((_, i) => mastAt(z0 + (z1 - z0) * i / n)));
    sleeveG.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 60, SLEEVE_R, 22, false), MAT.cloth));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(SLEEVE_R, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), MAT.cloth); cap.position.copy(mastAt(z1)); cap.scale.y = .6; sleeveG.add(cap);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(SLEEVE_R, .003, 6, 24), MAT.cloth); hem.rotation.x = Math.PI / 2; hem.position.copy(mastAt(z0)); sleeveG.add(hem);
    adopt('luffSleeve', sleeveG);
  }

  // Vang: mast tang → vang cleat block … key block → boom key (rule 3(d)); built once, turns with the boom.
  {
    const g = new THREE.Group();
    const lo = new V3(-LOWER_R - .03, Y(TANG) + .02, 0), hi = new V3(-U_KEY, yB - BOOM_R - .045, 0);
    const d = hi.clone().sub(lo).normalize();
    const bLo = block(.02, MAT.black, .03), bHi = block(.018, MAT.black, .024);
    bLo.position.copy(lo.clone().addScaledVector(d, .04)); bLo.rotation.z = Math.atan2(-d.y, -d.x) - Math.PI / 2;   // shackle toward its fitting
    bHi.position.copy(hi.clone().addScaledVector(d, -.03)); bHi.rotation.z = Math.atan2(d.y, d.x) - Math.PI / 2;
    g.add(bLo, bHi);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(.04, .02, .035), MAT.grey); cam.position.copy(bLo.position).add(new V3(-.03, -.005, 0)); g.add(cam);
    g.add(cylBetween(lo, bLo.position, .004, MAT.steel), cylBetween(hi, bHi.position, .004, MAT.steel));
    const a = bLo.position.clone().addScaledVector(d, .02), b = bHi.position.clone().addScaledVector(d, -.02);
    for (const z of [-.011, -.004, .004, .011]) g.add(tube([a.clone().add(new V3(0, 0, z)), b.clone().add(new V3(0, 0, z))], .0028, ROPE.vang, 6));
    const tail = cam.position.clone().add(new V3(-.02, 0, 0));
    g.add(tube([tail, tail.clone().add(new V3(-.08, -.06, .03)), tail.clone().add(new V3(-.12, -.2, .08)), tail.clone().add(new V3(-.1, -.27, .14))], .0028, ROPE.vang, 24));
    const loop = new THREE.Mesh(new THREE.TorusGeometry(.025, .004, 6, 16), ROPE.handle); loop.position.copy(tail).add(new V3(-.1, -.3, .16)); g.add(loop);
    add(swing, 'vang', g);
  }
  // Clew tie-down: a webbing strap round the boom through the clew cringle (rule 3(g)).
  {
    const g = new THREE.Group(), u = U_C - .05;
    const strap = new THREE.Mesh(new THREE.TorusGeometry(.04, .006, 6, 24), MAT.strap); strap.scale.set(.9, 1.7, 1); strap.rotation.y = Math.PI / 2; strap.position.set(-u, yB + .02, 0); g.add(strap);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(.012, .02, .03), MAT.steel); buckle.position.set(-u, yB - BOOM_R - .008, 0); g.add(buckle);
    add(swing, 'clewTieDown', g);
  }

  // ---- invisible pick helpers for parts of the sail
  const helperMat = new THREE.MeshBasicMaterial({ color: '#ff7a33', transparent: true, opacity: 0, depthWrite: false });
  helperMat.userData.helper = true;
  const helpers = {};
  for (const id of ['luff', 'leech', 'foot', 'head', 'tack', 'clew', 'battens', 'window', 'sailNumber', 'telltales']) {
    helpers[id] = new THREE.Group(); add(swing, id, helpers[id], { helper: true, noPick: id === 'sailNumber' });
  }
  // Fixed (s, t) samples for the helpers, from the reference layout.
  const ST = {
    battens: POCKETS.map(p => [...Array(9)].map((_, k) => invRef(...addv(p.q, p.nin, p.len * k / 8)))),
    window: (() => { const o = []; for (let b = 0; b <= 8; b++) for (let a = 0; a <= 8; a++) { const lo = lerp2(WINDOW[0], WINDOW[1], a / 8), hi = lerp2(WINDOW[3], WINDOW[2], a / 8); o.push(invRef(...lerp2(lo, hi, b / 8))); } return o; })(),
    numbers: ['stbd', 'port'].flatMap(side => ['letters', 'number'].map(k => {
      const row = SAILNO[side][k], n = k === 'letters' ? SAIL_LETTERS.length : SAIL_NUMBER.length, wlen = .1 + n * (CHAR_W + CHAR_GAP);
      const o = []; for (let b = 0; b <= 4; b++) for (let a = 0; a <= 8; a++) o.push(invRef(...addv(addv(row.o, row.nin, .05 + wlen * a / 8), row.tg, -.02 + (NUM_H + .04) * b / 4)));
      return o;
    })),
    telltales: [...TELLTALES, ...POCKETS.slice(1).map(p => addv(p.q, p.nin, .05))].map(([u, v]) => invRef(u + .055, v)),
  };
  function buildHelpers() {
    const H = (id, obj) => { clearGroup(helpers[id]); for (const o of [].concat(obj)) { o.material = helperMat; helpers[id].add(o); } adopt(id, helpers[id], { helper: true, noPick: id === 'sailNumber' }); };
    const line = (fn, n, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...Array(n + 1)].map((_, i) => fn(i / n))), n * 2, r, 8, false));
    const patch = (pts, nx, ny, lift) => {
      const g = gridGeo(nx, ny, (a, b) => { const p = sailXYZ(...pts[Math.round(b * ny) * (nx + 1) + Math.round(a * nx)], 0); return [p.x, p.y, p.z + lift]; });
      return new THREE.Mesh(g);
    };
    H('luff', line(k => mastAt(GOOSE + V_T + (V_H - V_T) * k).add(new V3(0, 0, 0)), 24, SLEEVE_R + .016));
    H('leech', line(k => sailXYZ(1, k * .995, 0), 30, .022));
    H('foot', line(k => sailXYZ(k, 0, 0), 20, .02));
    const ball = (p, r = .07) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12)); m.position.copy(p); return m; };
    H('tack', ball(sailXYZ(.01, .01, 0))); H('clew', ball(sailXYZ(1, 0, 0))); H('head', ball(sailXYZ(0, 1, 0), .09));
    H('battens', ST.battens.map(b => line(k => sailXYZ(...b[Math.round(k * 8)], 0), 8, .025)));
    H('window', [patch(ST.window, 8, 8, .005), patch(ST.window, 8, 8, -.005)]);
    H('sailNumber', ST.numbers.flatMap(p => [patch(p, 8, 4, .005), patch(p, 8, 4, -.005)]));
    H('telltales', ST.telltales.map(st => ball(sailXYZ(...st, 0), .05)));
  }

  /* ---------------- ropes that run between the turning rig and the deck ----------------
     Rebuilt in boat space on every trim change and while the parts explode. */
  const sheetG = new THREE.Group(); add(boat, 'mainsheet', sheetG);
  const travG = new THREE.Group(); add(boat, 'traveller', travG);
  const cunnG = new THREE.Group(); add(boat, 'cunningham', cunnG);
  const outG = new THREE.Group(); add(boat, 'outhaul', outG);
  const retG = new THREE.Group(); add(boat, 'mastRetainer', retG);
  function buildLines() {
    swing.updateMatrix();
    const W = (v, id) => v.clone().applyMatrix4(swing.matrix).add(offsetOf(id));
    const B = (id, v) => v.clone().add(offsetOf(id));
    const onBoom = (u, dy, id = 'boomBlocks') => W(new V3(-u, yB - BOOM_R - dy, 0), id);

    // traveller: one line, a closed loop through the two eyes, free end through the cleat (rule 3(h));
    // the traveller block rides on it below the end of the boom, and the tiller passes underneath.
    clearGroup(travG);
    const be = onBoom(U_ABLK, 0, 'boom'), eyes = TR_EYE.map(e => B('travellerFairleads', e));
    const tz = clamp(be.z * .92, -TR_Z + .07, TR_Z - .07), lift = .06 + .09 * Math.sqrt(1 - (tz / TR_Z) ** 2);
    const T = new V3(X(TR_X) - .01, Y(deckY(TR_X, tz)) + lift, tz).add(offsetOf('traveller'));
    const tillerTop = TIL_Y + .016 + offsetOf('tiller').y;
    const span = e => { const a = [T, e]; if (Math.sign(e.z) !== Math.sign(T.z) || Math.abs(T.z) < .05) { const k = T.z / (T.z - e.z), y = T.y + (e.y - T.y) * k; if (y < tillerTop + .004) a.splice(1, 0, new V3(T.x + (e.x - T.x) * k, tillerTop + .005, 0)); } return a; };
    const cleat = B('travellerFairleads', onDeck(TC_X, 0, .016));
    const deckRun = (from, to, n = 6) => [...Array(n + 1)].map((_, i) => { const k = i / n, xa = from[0] + (to[0] - from[0]) * k, z = from[1] + (to[1] - from[1]) * k; return B('travellerFairleads', onDeck(xa, z, .012)); });
    travG.add(tube(polyCurve([...deckRun([TC_X - .02, .01], [TR_X + .03, TR_Z - .01]), ...span(eyes[1]).reverse()]), .0035, ROPE.traveller, 120));
    travG.add(tube(polyCurve([T, ...span(eyes[0]).slice(1), ...deckRun([TR_X + .03, -TR_Z + .01], [TC_X - .02, -.01])]), .0035, ROPE.traveller, 120));
    travG.add(tube([cleat, cleat.clone().add(new V3(.06, .005, .02)), cleat.clone().add(new V3(.1, -.02, .06)), B('travellerFairleads', new V3(X(CK.a) - .005, Y(deckY(CK.a, .1)) - .03, .1))], .0035, ROPE.traveller, 20));
    const travBlock = block(.02); travBlock.position.copy(T).add(new V3(0, .03, 0)); travBlock.rotation.set(Math.PI, Math.PI / 2, 0); travG.add(travBlock);   // shackle down on the rope
    adopt('traveller', travG);

    // mainsheet: aft boom block becket → traveller block → aft boom block → boom eye strap → forward boom block → ratchet block (rule 3(c))
    clearGroup(sheetG);
    const r = B('ratchetBlock', posR), tb = travBlock.position;
    const pts = [onBoom(U_ABLK - .015, .065), tb.clone().add(new V3(0, -.012, .012)), tb.clone().add(new V3(0, -.012, -.012)), onBoom(U_ABLK + .015, .045), onBoom(U_ABLK, .02),
      onBoom(U_ESTRAP, .004), onBoom(U_FBLK + .015, .02), onBoom(U_FBLK, .045), r.clone().add(new V3(.03, .01, 0)), r.clone().add(new V3(-.03, -.005, .01))];
    sheetG.add(tube(polyCurve(pts), .0042, ROPE.main, 240));
    const fl = Y(FLOOR(1.5)) + .006 + offsetOf('ratchetBlock').y;
    const tail = [pts[pts.length - 1], new V3(X(1.85), Y(.4) + offsetOf('ratchetBlock').y, .15), new V3(X(1.75), Y(.36), .27), new V3(X(1.62), fl + .07, .24), new V3(X(1.55), fl, .17), new V3(X(1.62), fl, .08), new V3(X(1.48), fl, .05), new V3(X(1.38), fl, .14)];
    sheetG.add(tube(tail, .0042, ROPE.main, 80, 'centripetal'));
    adopt('mainsheet', sheetG);

    // cunningham: tied at the gooseneck, up through the tack cringle, down to the deck block, aft to its cam cleat
    clearGroup(cunnG);
    const ce = W(sailXYZ(...CE_ST, 0), 'sail');
    const tie = W(new V3(LOWER_R * .2 - .005, yB + .03, LOWER_R + .003), 'gooseneck');
    const dbP = B('deckBlock', DECK_BLK.port), clP = B('controlCleats', CLEAT.port);
    cunnG.add(tube(polyCurve([tie, ce.clone().add(new V3(0, .005, .006)), ce.clone().add(new V3(0, -.006, -.006)), W(new V3(-LOWER_R - .03, Y(TANG) + .05, -.03), 'gooseneck'), dbP.clone().add(new V3(.004, .012, 0)), dbP.clone().add(new V3(-.012, -.006, 0)), clP.clone().add(new V3(.03, 0, 0)), clP]), .0026, ROPE.cunningham, 120));
    cunnG.add(tube([clP, clP.clone().add(new V3(-.08, .02, -.03)), clP.clone().add(new V3(-.2, .01, -.09)), B('controlCleats', onDeck(2.36, -.2, .01))], .0026, ROPE.cunningham, 24));
    adopt('cunningham', cunnG);

    // outhaul: clew → boom-end fairlead → along the boom → gooseneck block → deck block → its cam cleat
    clearGroup(outG);
    const cw = W(sailXYZ(1, 0, 0).add(new V3(.02, .01, 0)), 'sail');
    const along = [BOOM_END - .03, U_CLEAT + .04, U_CLEAT - .04, 1.2, .6, .2].map((u, i) => W(new V3(-u, yB + BOOM_R + (i === 1 || i === 2 ? .016 : .006), i > 2 ? .012 : 0), 'boom'));
    const gb = W(new V3(-LOWER_R - .02, yB + .045, .022), 'gooseneck');
    const dbS = B('deckBlock', DECK_BLK.stbd), clS = B('controlCleats', CLEAT.stbd);
    outG.add(tube(polyCurve([cw, ...along, gb, W(new V3(-LOWER_R - .03, Y(TANG) + .05, .03), 'gooseneck'), dbS.clone().add(new V3(.004, .012, 0)), dbS.clone().add(new V3(-.012, -.006, 0)), clS.clone().add(new V3(.03, 0, 0)), clS]), .0026, ROPE.outhaul, 160));
    outG.add(tube([clS, clS.clone().add(new V3(-.08, .02, .03)), clS.clone().add(new V3(-.2, .01, .09)), B('controlCleats', onDeck(2.36, .2, .01))], .0026, ROPE.outhaul, 24));
    adopt('outhaul', outG);

    // retention line between the deck block and the mast tang (rule 3(b)xi)
    clearGroup(retG);
    retG.add(tube([B('mastRetainer', DECK_BLK.port.clone().add(new V3(.014, -.022, -.02))), B('mastRetainer', onDeck(MX - .045, -.03, .03)), W(new V3(-LOWER_R - .02, Y(TANG) - .005, -.006), 'mastRetainer')], .002, ROPE.tie, 16));
    adopt('mastRetainer', retG);
  }

  /* ---------------- waterline footprint for the water shader ---------------- */
  const wlStart = (() => { let x = 0; while (zk(x) > WL && x < 2) x += .005; return x; })();
  const wlEnd = (() => { let x = 2; while (zk(x) < WL && x < L) x += .002; return x; })();
  const waterline = { x0: X(wlStart), x1: X(wlEnd), hb: [...Array(48)].map((_, i) => sideHalf(wlStart + (wlEnd - wlStart) * i / 47, WL)) };

  // Key dimensions, for checking against the class figures (console: youngsails.model.dims).
  const sailArea = (() => { let a = 0; const n = 60; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const p = refP(i / n, j / n), q = refP((i + 1) / n, j / n), r = refP(i / n, (j + 1) / n), s = refP((i + 1) / n, (j + 1) / n); a += Math.abs((s[0] - p[0]) * (r[1] - q[1]) - (s[1] - p[1]) * (r[0] - q[0])) / 2; } return a; })();
  const dims = {
    loa: L, beam: 2 * hd(1.75), lwl: wlEnd - wlStart, hullDraft: WL, boardBelowHull: YK - DB_BOT, draft: WL - DB_BOT,
    mast: MAST_TOP - HEEL, boom: 2.74, luff: V_H - V_T, leech: Math.hypot(REF.head[0] - REF.clew[0], REF.head[1] - REF.clew[1]), foot: REF.clew[0] - REF.tack[0], sailArea,
    displacement: SAILING_MASS, transomBeam: 2 * hd(0),
  };

  /* ---------------- model API ---------------- */
  function setTrim(boomDeg, time = 0) {
    const a = Math.abs(boomDeg);
    trim.phi = deg(boomDeg); trim.side = boomDeg < 0 ? -1 : 1;
    trim.depth = smooth(2, 14, a);
    trim.twist = deg(4 + 8 * smooth(10, 60, a)) * trim.depth;
    trim.bend = BEND_MIN + (BEND_MAX - BEND_MIN) * (1 - smooth(10, 45, a)) * (.4 + .6 * trim.depth);
    swing.rotation.y = trim.phi;
    const windSide = boomDeg < 0 ? 1 : -1;   // boom to port → wind over starboard
    vane.rotation.y = -windSide * deg(windAngleFromBoom(boomDeg)) - trim.phi;   // the wand turns with the mast
    refreshPlan(); updateSailGeo(time); buildMast(); buildSleeve(); buildHelpers(); buildLines();
  }
  function anchor(id, out) {   // label positions for parts whose bounding-box centre is a poor spot
    if (id === 'mastLower') { out.copy(mastAt((DECK_M + GOOSE) / 2 + .05)).applyMatrix4(swing.matrixWorld); return true; }
    if (id === 'mastTop') { out.copy(mastAt(LOWER_TOP + 1.4)).add(new V3(0, 0, 0)).applyMatrix4(swing.matrixWorld); return true; }
    if (id === 'sail') { out.copy(sailXYZ(.4, .35, 0)).applyMatrix4(swing.matrixWorld); return true; }
    return false;
  }
  function redraw() { for (const k of ['port', 'stbd']) { drawSail(sailTex[k].image.getContext('2d'), k); sailTex[k].needsUpdate = true; } }

  refreshPlan();
  return {
    boat, swing, waterline, floorY: Y(DB_BOT) - .02, dims, shadowSize: 6.5,
    home: { pos: new V3(7.4, 3.3, 7.2), target: new V3(-.3, 1.9, 0), tallDrop: 1.9 },   // tallDrop: lower the target on phones so the hull clears the info card
    defaultBoom: -20,
    setTrim, anchor, redraw,
    update: time => updateSailGeo(time),
    onExplode: buildLines,
  };
}
