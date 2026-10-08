// Optimist — procedural 3D model of the International Optimist dinghy.
// Dimensions follow the IODA class rules (hull 2300 mm, mast ≤ 2350, boom ≤ 2057,
// sprit ≤ 2286, daggerboard 1067 × 285, three 45 L buoyancy bags, mainsheet floor
// blocks at 786 / 894 mm from the transom). Hull curves are an approximation fitted
// to the rule reference points; official offsets are not public.
//
// Units: metres. Hull lines use xa = distance forward of the aft transom and
// zb = height above the class-rule base line. World: +x bow, +y up (0 = waterline), +z starboard.
import * as THREE from 'three';
import {
  V3, UP, clamp, smooth, deg, rnd, mono, gridGeo, sweep, chaikin, cylBetween, roundRect, slotPath,
  pillowGeo, canvasTex, ropeMat, tube, polyCurve, clearGroup, decal,
} from '../../assets/js/explorer/geometry.js';
import { windAngleFromBoom } from '../../assets/js/core/sailing.js';

const SAIL_LETTERS = 'BUL', SAIL_NUMBER = '1947';   // 1947: the year Clark Mills designed the Optimist

export function createOptimist({ registry }) {
  const { reg, add, adopt, offsetOf, PART } = registry;

  /* ---------------- hull lines ---------------- */
  const L = 2.30, XC_END = 2.17, XOFF = 1.15, WL = .115, T = .007;
  const X = xa => xa - XOFF, Y = zb => zb - WL;
  const bottomZ = mono([[0, .105], [.3, .07], [.65, .044], [1.0, .033], [1.35, .038], [1.7, .068], [1.95, .11], [2.121, .162], [2.17, .185]]);
  const sheerZ = mono([[0, .42], [.6, .419], [1.15, .423], [1.8, .437], [2.3, .46]]);
  const sheerH = mono([[0, .46], [.3, .515], [.7, .552], [1.1, .565], [1.5, .553], [1.85, .505], [2.1, .425], [2.3, .30]]);
  const chineH = mono([[0, .37], [.3, .42], [.7, .448], [1.1, .455], [1.5, .443], [1.85, .39], [2.05, .31], [2.17, .235]]);
  const floorZ = xa => bottomZ(xa) + T;

  // Side panel = ruled surface: station s joins the chine at s·2.17 m to the sheer at s·2.30 m.
  function endShift(s, inner) { if (!inner) return 0; let d = 0; if (s < .03) d += T * (1 - s / .03); if (s > .97) d -= T * ((s - .97) / .03); return d; }
  function hp(s, t, side, inner) {
    const xc = s * XC_END, xs = s * L, dx = endShift(s, inner), o = inner ? T : 0;
    const ch = chineH(xc) - o, sh = sheerH(xs) - o, zc = bottomZ(xc) + o, zs = sheerZ(xs);
    return [X(xc + (xs - xc) * t + dx), Y(zc + (zs - zc) * t), side * (ch + (sh - ch) * t)];
  }
  function bp(s, v, inner) {
    const xc = s * XC_END, o = inner ? T : 0;
    return [X(xc + endShift(s, inner)), Y(bottomZ(xc) + o), (2 * v - 1) * (chineH(xc) - o)];
  }
  // Half-breadth of the hull side at xa and height zb.
  function sideHalf(xa, zb, inner = true) {
    const o = inner ? T : 0; let s = xa / L, xc, xs, t;
    for (let k = 0; k < 16; k++) {
      xc = s * XC_END; xs = s * L;
      const zc = bottomZ(xc) + o, zs = sheerZ(xs); t = (zb - zc) / (zs - zc);
      s = clamp(s + (xa - (xc + (xs - xc) * t)) / 2.2, 0, 1);
    }
    xc = s * XC_END; xs = s * L;
    const zc = bottomZ(xc) + o, zs = sheerZ(xs); t = clamp((zb - zc) / (zs - zc), 0, 1);
    return (chineH(xc) - o) + ((sheerH(xs) - o) - (chineH(xc) - o)) * t;
  }

  /* ---------------- materials ---------------- */
  const noiseTex = canvasTex(256, 256, (g, w, h) => {
    const im = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) { const v = 110 + rnd() * 145; im.data.set([v, v, v, 255], i * 4); }
    g.putImageData(im, 0, 0);
  }, false);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping; noiseTex.repeat.set(26, 12);
  const MAT = {
    paint: new THREE.MeshPhysicalMaterial({ color: '#f4f4ef', roughness: .34, clearcoat: .7, clearcoatRoughness: .22 }),
    inner: new THREE.MeshPhysicalMaterial({ color: '#eef0ec', roughness: .45, clearcoat: .35 }),
    floor: new THREE.MeshStandardMaterial({ color: '#dfe3e1', roughness: .9, bumpMap: noiseTex, bumpScale: .002 }),
    alu: new THREE.MeshStandardMaterial({ color: '#d3d9df', metalness: .9, roughness: .28 }),
    steel: new THREE.MeshStandardMaterial({ color: '#e8ecef', metalness: 1, roughness: .18 }),
    black: new THREE.MeshStandardMaterial({ color: '#1c2026', roughness: .55 }),
    strake: new THREE.MeshStandardMaterial({ color: '#56606b', roughness: .6 }),
    foil: new THREE.MeshPhysicalMaterial({ color: '#f6f7f5', roughness: .26, clearcoat: .5 }),
    wood: new THREE.MeshStandardMaterial({ color: '#a86c3a', roughness: .55 }),
    bag: new THREE.MeshStandardMaterial({ color: '#dbe5ee', roughness: .65 }),
    strap: new THREE.MeshStandardMaterial({ color: '#2b323d', roughness: .85 }),
    toe: new THREE.MeshStandardMaterial({ color: '#1d417d', roughness: .75 }),
    red: new THREE.MeshStandardMaterial({ color: '#d0312d', roughness: .5 }),
    yellow: new THREE.MeshStandardMaterial({ color: '#f2c12e', roughness: .5 }),
    bottle: new THREE.MeshPhysicalMaterial({ color: '#2f7fd9', roughness: .3, clearcoat: .5, side: THREE.DoubleSide }),
  };
  MAT.paint.userData.paint = true;
  const ROPE = {
    main: ropeMat('#1f4f9e', '#f1f3f5'), vang: ropeMat('#c62f2f', '#f4f4f4'), halyard: ropeMat('#2f8a4f', '#f4f4f4'),
    outhaul: ropeMat('#e7b416', '#2a2a2a'), tie: ropeMat('#f2f2ee', '#c9c9c2'), painter: ropeMat('#f2c12e', '#1f2a36'),
    lanyard: ropeMat('#2563c9', '#dfe8f5'), elastic: ropeMat('#191c20', '#353b44'),
  };

  const boat = new THREE.Group();
  const swing = new THREE.Group();   // boom, sail, sprit: rotates around the mast
  registry.setPivot(swing);

  /* ---------------- hull shell ---------------- */
  const NS = 64;
  add(boat, 'hull', new THREE.Mesh(gridGeo(NS, 8, (s, v) => bp(s, v, false), [0, -1, 0]), MAT.paint));
  for (const side of [1, -1]) add(boat, 'hull', new THREE.Mesh(gridGeo(NS, 6, (s, t) => hp(s, t, side, false), [0, 0, side]), MAT.paint));
  add(boat, 'hull', new THREE.Mesh(gridGeo(NS, 8, (s, v) => bp(s, v, true), [0, 1, 0]), MAT.floor));
  for (const side of [1, -1]) add(boat, 'hull', new THREE.Mesh(gridGeo(NS, 6, (s, t) => hp(s, t, side, true), [0, 0, -side]), MAT.inner));

  function transomFn(xaBottom, xaTop, inner) {
    const o = inner ? T : 0;
    return (u, v) => {
      const s = xaBottom > 1 ? 1 : 0, xc = s * XC_END;
      const b = [X(xaBottom), Y(bottomZ(xc) + o), (2 * u - 1) * (chineH(xc) - o)];
      const t = [X(xaTop), Y(sheerZ(s * L)), (2 * u - 1) * (sheerH(s * L) - o)];
      return [b[0] + (t[0] - b[0]) * v, b[1] + (t[1] - b[1]) * v, b[2] + (t[2] - b[2]) * v];
    };
  }
  add(boat, 'bowTransom', new THREE.Mesh(gridGeo(10, 6, transomFn(XC_END, L, false), [1, 0, 0]), MAT.paint));
  add(boat, 'bowTransom', new THREE.Mesh(gridGeo(10, 6, transomFn(XC_END - T, L - T, true), [-1, 0, 0]), MAT.inner));
  add(boat, 'sternTransom', new THREE.Mesh(gridGeo(10, 6, transomFn(0, 0, false), [-1, 0, 0]), MAT.paint));
  add(boat, 'sternTransom', new THREE.Mesh(gridGeo(10, 6, transomFn(T, T, true), [1, 0, 0]), MAT.inner));

  // Sheer loop (starboard → bow → port → stern) with softened corners, for the gunwale and strake.
  const sheerLoop = (() => {
    const p = [], N = 70;
    for (let i = 0; i <= N; i++) p.push(new V3(...hp(i / N, 1, 1, false)));
    for (let j = 1; j < 16; j++) p.push(new V3(X(L), Y(sheerZ(L)), sheerH(L) * (1 - 2 * j / 16)));
    for (let i = N; i >= 0; i--) p.push(new V3(...hp(i / N, 1, -1, false)));
    for (let j = 1; j < 24; j++) p.push(new V3(X(0), Y(sheerZ(0)), -sheerH(0) * (1 - 2 * j / 24)));
    return chaikin(p, 2);
  })();
  const GUNWALE = [[.004, -.016], [.007, 0], [.001, .011], [-.02, .015], [-.042, .013], [-.054, .006], [-.057, -.003], [-.05, -.011], [-.03, -.014], [-.008, -.018]];
  const STRAKE = [[-.002, -.042], [.01, -.044], [.019, -.036], [.023, -.02], [.02, -.004], [.011, .004], [-.002, .004]];
  add(boat, 'gunwale', new THREE.Mesh(sweep(sheerLoop, GUNWALE, true), MAT.paint));
  add(boat, 'rubbingStrake', new THREE.Mesh(sweep(sheerLoop, STRAKE, true), MAT.strake));

  /* ---------------- interior structure ---------------- */
  function sectionPts(xa, z0, z1, n, inset = 0) {
    const a = []; for (let k = 0; k <= n; k++) { const z = z0 + (z1 - z0) * k / n; a.push([sideHalf(xa, z) - inset, z]); } return a;
  }
  function extrudeX(shape, xa, depth) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 18 });
    g.rotateY(Math.PI / 2); g.translate(X(xa) - depth / 2, 0, 0); return g;
  }
  function extrudeUp(shape, zb0, height, bevel) {
    const g = new THREE.ExtrudeGeometry(shape, bevel ? { depth: height - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 20 } : { depth: height, bevelEnabled: false, curveSegments: 20 });
    g.rotateX(-Math.PI / 2); g.translate(0, Y(zb0) + (bevel || 0), 0); return g;
  }

  // Midship frame: a U-frame following the hull section, low across the floor.
  const MF_X = 1.03;
  {
    const fl = floorZ(MF_X), zt = sheerZ(MF_X) - .016, out = sectionPts(MF_X, fl, zt, 12), inn = sectionPts(MF_X, fl + .1, zt, 12, .04), s = new THREE.Shape();
    s.moveTo(-out[12][0], Y(out[12][1]));
    for (let k = 11; k >= 0; k--) s.lineTo(-out[k][0], Y(out[k][1]));
    for (let k = 0; k <= 12; k++) s.lineTo(out[k][0], Y(out[k][1]));
    for (let k = 12; k >= 0; k--) s.lineTo(inn[k][0], Y(inn[k][1]));
    for (let k = 0; k <= 12; k++) s.lineTo(-inn[k][0], Y(inn[k][1]));
    add(boat, 'midshipFrame', new THREE.Mesh(extrudeX(s, MF_X, .03), MAT.inner));
  }

  // Daggerboard case: slot 330 × 17 mm, top parallel to the base line.
  const CASE_TOP = .355, SLOT0 = 1.10, SLOT1 = 1.43;
  {
    const s = roundRect(X(1.045), -.032, X(1.465), .032, .012, .012, .012, .012);
    s.holes.push(slotPath(X(SLOT0), X(SLOT1), .0085));
    add(boat, 'daggerboardCase', new THREE.Mesh(extrudeUp(s, .04, CASE_TOP - .04, .004), MAT.inner));
  }

  // Mast thwart (plank with the mast hole) and the bulkhead under it.
  const MAST_X = 1.92, MT_A = 1.80, MT_F = 2.02, MT_TOP = sheerZ(1.91) - .004, MT_TH = .026;
  {
    const zMid = MT_TOP - MT_TH / 2, s = new THREE.Shape(), N = 10;
    s.moveTo(X(MT_A), -sideHalf(MT_A, zMid));
    for (let i = 0; i <= N; i++) { const xa = MT_A + (MT_F - MT_A) * i / N; s.lineTo(X(xa), sideHalf(xa, zMid)); }
    for (let i = N; i >= 0; i--) { const xa = MT_A + (MT_F - MT_A) * i / N; s.lineTo(X(xa), -sideHalf(xa, zMid)); }
    const hole = new THREE.Path(); hole.absarc(X(MAST_X), 0, .027, 0, Math.PI * 2, true); s.holes.push(hole);
    add(boat, 'mastThwart', new THREE.Mesh(extrudeUp(s, MT_TOP - MT_TH, MT_TH, .004), MAT.inner));
    const sleeve = new THREE.Mesh(new THREE.TorusGeometry(.0255, .004, 8, 32), MAT.black);
    sleeve.rotation.x = Math.PI / 2; sleeve.position.set(X(MAST_X), Y(MT_TOP) + .002, 0);
    add(boat, 'mastThwart', sleeve);
    const fl = floorZ(MT_A), zt = MT_TOP - MT_TH, out = sectionPts(MT_A, fl, zt, 12), b = new THREE.Shape();
    b.moveTo(-out[12][0], Y(zt));
    for (let k = 11; k >= 0; k--) b.lineTo(-out[k][0], Y(out[k][1]));
    for (let k = 0; k <= 12; k++) b.lineTo(out[k][0], Y(out[k][1]));
    b.holes.push(roundRect(-.25, Y(fl + .07), .25, Y(zt - .085), .06, .06, .06, .06, new THREE.Path()));
    add(boat, 'mastThwart', new THREE.Mesh(extrudeX(b, MT_A + .006, .012), MAT.inner));
  }

  // Mast step: adjustable track on the floor with a socket for the heel.
  const HEEL = floorZ(MAST_X) + .035;
  {
    const g = new THREE.Group(), fy = Y(floorZ(MAST_X));
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.2, .012, .08), MAT.alu); plate.position.set(X(MAST_X), fy + .009, 0);
    plate.rotation.z = Math.atan((bottomZ(2.0) - bottomZ(1.84)) / .16);
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(.033, .036, .03, 28), MAT.black); sock.position.set(X(MAST_X), fy + .025, 0);
    g.add(plate, sock);
    for (const dx of [-.075, -.045, .045, .075]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .004, 10), MAT.black); h.position.set(X(MAST_X) + dx, fy + .013, 0); g.add(h); }
    add(boat, 'mastStep', g);
  }

  // Buoyancy: two side bags (between midship frame and bulkhead) and one across the stern.
  function bagWithStraps(lx, ly, lz, axis, strapsAt) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(pillowGeo(lx, ly, lz), MAT.bag));
    for (const p of strapsAt) {
      const st = new THREE.Mesh(axis === 'x' ? pillowGeo(.045, ly * 1.04, lz * 1.05) : pillowGeo(lx * 1.05, ly * 1.04, .045), MAT.strap);
      if (axis === 'x') st.position.x = p; else st.position.z = p;
      g.add(st);
    }
    return g;
  }
  {
    const xa = 1.42, zc = floorZ(xa) + .19;
    const flare = Math.atan((sideHalf(xa, .35) - sideHalf(xa, .1)) / .25);
    for (const side of [1, -1]) {
      const b = bagWithStraps(.7, .3, .2, 'x', [-.2, .2]);
      b.position.set(X(xa), Y(zc), side * (sideHalf(xa, zc) - .135));
      b.rotation.x = side * flare;
      const valve = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .02, 14), MAT.black);
      valve.position.set(.25, .13, -side * .03); b.add(valve);
      add(boat, 'buoyancy', b, { off: [0, .6, side * .45] });
    }
    const ax = T + .108, za = floorZ(.1) + .13;
    const aft = bagWithStraps(.2, .25, 2 * sideHalf(.1, za) - .04, 'z', [-.28, 0, .28]);
    aft.position.set(X(ax), Y(za), 0);
    add(boat, 'buoyancy', aft, { off: [-.45, .55, 0] });
  }

  // Toe straps, lifted off the floor by a shock cord from the aft gunwale.
  {
    const fl = x => Y(floorZ(x));
    const prof = [[-.025, -.005], [.025, -.005], [.025, .005], [-.025, .005]];
    const g = new THREE.Group();
    for (const side of [1, -1]) {
      const pts = [[1.0, .07, .07], [.86, .11, .085], [.66, .135, .09], [.45, .115, .08], [.3, .06, .06], [.22, .02, .05]].map(([x, h, z]) => new V3(X(x), fl(x) + h, side * z));
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      g.add(new THREE.Mesh(sweep(curve.getSpacedPoints(48), prof, false), MAT.toe));
      g.add(new THREE.Mesh(sweep(curve.getSpacedPoints(48).slice(10, 34), [[-.03, -.009], [.03, -.009], [.03, .009], [-.03, .009]], false), MAT.toe));
      const cord = new THREE.CatmullRomCurve3([new V3(X(.03), Y(sheerZ(.03)) - .01, 0), new V3(X(.3), fl(.3) + .28, side * .03), curve.getPointAt(.55)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(cord, 24, .003, 6), MAT.black));
      for (const x of [1.0, .22]) { const pl = new THREE.Mesh(new THREE.BoxGeometry(.05, .006, .02), MAT.alu); pl.position.set(X(x) + (x > .5 ? -.02 : 0), fl(x) + (x > .5 ? .07 : .003), side * (x > .5 ? .07 : .05)); g.add(pl); }
    }
    add(boat, 'toeStraps', g);
  }

  /* ---------------- rudder, tiller, extension ---------------- */
  const RUD_X = X(0) - .035;
  {
    const g = new THREE.Group();   // gudgeons (transom) + pintles (rudder), bearing lines 200 mm apart
    for (const zb of [.385, .185]) {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(.006, .06, .03), MAT.steel); plate.position.set(X(0) - .003, Y(zb), 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.03, .008, .016), MAT.steel); arm.position.set(X(0) - .02, Y(zb) - .01, 0);
      const eye = new THREE.Mesh(new THREE.TorusGeometry(.007, .003, 8, 16), MAT.steel); eye.rotation.x = Math.PI / 2; eye.position.set(RUD_X, Y(zb) - .01, 0);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(.003, .003, .04, 8), MAT.steel); pin.position.set(RUD_X, Y(zb) - .005, 0);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(.03, .025, .019), MAT.steel); strap.position.set(RUD_X - .012, Y(zb) + .02, 0);
      g.add(plate, arm, eye, pin, strap);
    }
    const clip = new THREE.Mesh(new THREE.BoxGeometry(.012, .03, .006), MAT.black); clip.position.set(RUD_X - .004, Y(.37), .012); g.add(clip);
    add(boat, 'gudgeons', g);

    const prof = [[0, .52], [0, -.40], [.012, -.445], [.05, -.472], [.12, -.478], [.19, -.468], [.235, -.44], [.252, -.39], [.256, 0], [.25, .07], [.225, .12], [.185, .155], [.165, .2], [.16, .52]];
    const s = new THREE.Shape(); prof.forEach(([a, z], i) => i ? s.lineTo(-a, Y(z)) : s.moveTo(-a, Y(z)));
    const rg = new THREE.ExtrudeGeometry(s, { depth: .005, bevelEnabled: true, bevelThickness: .005, bevelSize: .008, bevelSegments: 3, curveSegments: 12 });
    rg.translate(RUD_X, 0, -.0025);
    add(boat, 'rudder', new THREE.Mesh(rg, MAT.foil));
    const dec = decal(`${SAIL_LETTERS} ${SAIL_NUMBER}`, .11, .03); dec.position.set(RUD_X - .09, Y(.43), .0081); add(boat, 'rudder', dec);

    const tg = new THREE.Group();
    const head = new THREE.Mesh(new THREE.BoxGeometry(.17, .055, .032), MAT.alu); head.position.set(RUD_X - .085, Y(.495), 0);
    const bolt1 = new THREE.Mesh(new THREE.CylinderGeometry(.005, .005, .036, 10), MAT.steel); bolt1.rotation.x = Math.PI / 2; bolt1.position.set(RUD_X - .04, Y(.495), 0);
    const bolt2 = bolt1.clone(); bolt2.position.x = RUD_X - .12;
    const tStart = new V3(RUD_X, Y(.5), 0), tEnd = new V3(X(.69), Y(.515), 0);
    tg.add(head, bolt1, bolt2, cylBetween(tStart, tEnd, .0125, MAT.alu));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.013, 14, 10), MAT.black); cap.position.copy(tEnd); tg.add(cap);
    add(boat, 'tiller', tg);

    const eg = new THREE.Group(), dir = new V3(.74, .3, .6).normalize();
    const j0 = tEnd.clone().add(new V3(-.01, .02, 0)), eEnd = j0.clone().addScaledVector(dir, .7);
    const joint = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .045, 14), MAT.black); joint.position.copy(j0); joint.quaternion.setFromUnitVectors(UP, dir);
    eg.add(joint, cylBetween(j0, eEnd, .0095, MAT.alu), cylBetween(j0.clone().addScaledVector(dir, .42), eEnd, .0145, MAT.black));
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.017, 14, 10), MAT.black); knob.position.copy(eEnd); eg.add(knob);
    add(boat, 'tillerExtension', eg);
  }

  /* ---------------- daggerboard (1067 × 285 mm, wooden stop battens) ---------------- */
  const DB_TOP = CASE_TOP + .035;
  {
    const g = new THREE.Group();
    const geo = new THREE.ExtrudeGeometry(roundRect(-.1345, -1.059, .1345, -.008, .024, .024, .001, .001), { depth: .005, bevelEnabled: true, bevelThickness: .005, bevelSize: .008, bevelSegments: 3, curveSegments: 10 });
    geo.translate(0, 0, -.0025);
    g.add(new THREE.Mesh(geo, MAT.foil));
    for (const side of [1, -1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.285, .035, .015), MAT.wood); b.position.set(0, -.0175, side * .015); g.add(b); }
    const dec = decal(`${SAIL_LETTERS} ${SAIL_NUMBER}`, .14, .032); dec.position.set(0, -.07, .0081); g.add(dec);
    g.position.set(X((SLOT0 + SLOT1) / 2), Y(DB_TOP), 0);
    add(boat, 'daggerboard', g);
  }

  /* ---------------- mast, wind indicator ---------------- */
  const MAST_R = .0225, MAST_LEN = 2.26, MAST_TOP = HEEL + MAST_LEN, BOOM_Z = .68;
  const mastG = new THREE.Group(); mastG.position.set(X(MAST_X), 0, 0);
  {
    const tubeM = new THREE.Mesh(new THREE.CylinderGeometry(MAST_R, MAST_R, MAST_LEN, 28), MAT.alu);
    tubeM.position.y = Y(HEEL) + MAST_LEN / 2; mastG.add(tubeM);
    const ring = (zb, h, mat, r = MAST_R + .0007) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), mat); m.position.y = Y(zb) + h / 2; mastG.add(m); };
    ring(HEEL - .002, .05, MAT.black, MAST_R + .001);   // heel plug
    ring(MAST_TOP - .01, .012, MAT.black, MAST_R + .0005);   // top cap
    ring(MAST_TOP - .610, .012, MAT.black);   // band 1: lower edge ≥ 610 mm from the top
    ring(MAST_TOP - .647, .012, MAT.black);   // band 2: upper edge ≤ 635 mm from the top
    ring(MT_TOP - .02, .05, MAT.strap, MAST_R + .002);   // collar at the thwart
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(.004, .004, .012, 8), MAT.steel);
    pin.rotation.z = Math.PI / 2; pin.position.set(MAST_R + .006, Y(MAST_TOP - 1.68), 0); mastG.add(pin);   // boom pin stop
    for (const [zb, z] of [[.56, 0], [BOOM_Z + .32, .01]]) {   // cleats: downhaul, sprit halyard
      const c = new THREE.Mesh(new THREE.BoxGeometry(.016, .07, .02), MAT.black); c.position.set(MAST_R + .008, Y(zb), z); mastG.add(c);
    }
  }
  boat.add(mastG); reg('mast', mastG);

  const vaneG = new THREE.Group(); vaneG.position.set(X(MAST_X), Y(MAST_TOP), 0);
  const vane = new THREE.Group(); vaneG.add(vane);
  {
    vaneG.add(cylBetween(new V3(0, 0, 0), new V3(0, .2, 0), .003, MAT.black));
    vane.add(cylBetween(new V3(-.16, .2, 0), new V3(.13, .2, 0), .0025, MAT.black));
    const tip = new THREE.Mesh(new THREE.ConeGeometry(.012, .04, 12), MAT.red); tip.rotation.z = -Math.PI / 2; tip.position.set(.15, .2, 0); vane.add(tip);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(.07, .05, .002), MAT.red); fin.position.set(-.14, .205, 0); vane.add(fin);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.008, 12, 8), MAT.black); ball.position.set(0, .2, 0); vane.add(ball);
  }
  boat.add(vaneG); reg('windIndicator', vaneG);

  /* ---------------- swing group: boom, sail, sprit, ties ----------------
     Local frame: −x = aft along the boom, y = world height, z = sail camber side. */
  swing.position.set(X(MAST_X), 0, 0); boat.add(swing);
  const yB = Y(BOOM_Z), BOOM_R = .0225;
  const S = { tack: [.035, .03], clew: [1.99, .03], peak: [1.47, 2.23], throat: [.035, 1.645] };   // sail corners: u aft of mast, v above boom
  const SPRIT_H = [0, .50], SPRIT_P = [1.49, 2.25];
  const sailUV = (u, v) => [u / 2.05, v / 2.25];

  {
    const g = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R, BOOM_R, 2.05, 24), MAT.alu); tb.rotation.z = Math.PI / 2; tb.position.set(-(.035 + 2.085) / 2, yB, 0); g.add(tb);
    const ring = (u0, len, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R + .0008, BOOM_R + .0008, len, 24), mat); m.rotation.z = Math.PI / 2; m.position.set(-(u0 + len / 2), yB, 0); g.add(m); };
    ring(2.0, .012, MAT.black);    // measurement band
    ring(2.065, .025, MAT.black);  // end cap
    const cleat = new THREE.Mesh(new THREE.BoxGeometry(.06, .014, .018), MAT.black); cleat.position.set(-1.55, yB + BOOM_R + .006, 0); g.add(cleat);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(.007, .0025, 8, 14), MAT.steel); eye.position.set(-2.03, yB + BOOM_R + .006, 0); g.add(eye);
    add(swing, 'boom', g);

    const j = new THREE.Group();
    for (const side of [1, -1]) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(.075, .034, .011), MAT.black); prong.position.set(.005, yB, side * (MAST_R + .008)); j.add(prong);
      const tipM = new THREE.Mesh(new THREE.CylinderGeometry(.017, .017, .011, 16), MAT.black); tipM.rotation.x = Math.PI / 2; tipM.position.set(.04, yB, side * (MAST_R + .008)); j.add(tipM);
    }
    const back = new THREE.Mesh(new THREE.CylinderGeometry(BOOM_R + .002, BOOM_R + .002, .07, 24), MAT.black); back.rotation.z = Math.PI / 2; back.position.set(-.06, yB, 0); j.add(back);
    const line = new THREE.Mesh(new THREE.TorusGeometry(MAST_R + .014, .0025, 6, 28, Math.PI * 1.2), MAT.strap);
    line.rotation.x = Math.PI / 2; line.rotation.z = -Math.PI * .1; line.position.set(0, Y(MAST_TOP - 1.68) - .004, 0); j.add(line);
    add(swing, 'boomJaws', j);
  }

  // ---- sail shape: camber from luff to leech, flat at foot and luff, pushed to leeward
  const uLeech = v => S.clew[0] + (S.peak[0] - S.clew[0]) * clamp((v - S.clew[1]) / (S.peak[1] - S.clew[1]), 0, 1);
  function segDist(u, v, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = clamp(((u - a[0]) * dx + (v - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(u - a[0] - dx * t, v - a[1] - dy * t);
  }
  const trim = { phi: deg(-22), depth: 1 };
  function camber(u, v, time) {
    const chord = Math.max(uLeech(v) - S.tack[0], .05);
    const s = clamp((u - S.tack[0]) / chord, 0, 1), t = clamp(v / S.peak[1], 0, 1);
    const prof = s < .42 ? 1 - ((.42 - s) / .42) ** 2 : 1 - ((s - .42) / .58) ** 2;
    const depth = .085 * (.5 + .5 * smooth(.04, .6, t));
    let w = chord * depth * prof * smooth(0, .14, v - S.tack[1]) * trim.depth;
    const side = trim.phi < 0 ? -1 : 1;   // leeward = the side the boom is on
    if (side > 0) w = Math.min(w, .006 + .5 * segDist(u, v, SPRIT_H, SPRIT_P));   // sail pressed onto the sprit: diagonal crease
    w *= side;
    w += Math.sin(time * 8.5 + v * 6.5 - s * 5) * .011 * s * s * (1 - trim.depth * .75) * smooth(0, .1, v - S.tack[1]);
    return w;
  }
  const sailLocal = (u, v, time = 0) => new V3(-u, yB + v, camber(u, v, time));

  const NU = 34, NV = 38, sailGeo = new THREE.BufferGeometry(), sailPlanar = [];
  {
    const pos = new Float32Array((NU + 1) * (NV + 1) * 3), uv = new Float32Array((NU + 1) * (NV + 1) * 2), idx = [];
    let q = 0;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const s = i / NU, t = j / NV;
      const u = (1 - t) * ((1 - s) * S.tack[0] + s * S.clew[0]) + t * ((1 - s) * S.throat[0] + s * S.peak[0]);
      const v = (1 - t) * ((1 - s) * S.tack[1] + s * S.clew[1]) + t * ((1 - s) * S.throat[1] + s * S.peak[1]);
      sailPlanar.push([u, v]); const [a, b] = sailUV(u, v); uv[q++] = a; uv[q++] = b;
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, d, b, a, c, d); }
    sailGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sailGeo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    sailGeo.setIndex(idx);
  }
  function updateSailGeo(time) {
    const p = sailGeo.attributes.position;
    for (let k = 0; k < sailPlanar.length; k++) { const [u, v] = sailPlanar[k]; p.setXYZ(k, -u, yB + v, camber(u, v, time)); }
    p.needsUpdate = true; sailGeo.computeVertexNormals(); sailGeo.computeBoundingSphere(); sailGeo.computeBoundingBox();
  }

  // ---- sail cloth texture, drawn in sail coordinates (u right = aft, v up); one per side
  const TW = 1024, TH = Math.round(1024 * 2.25 / 2.05);
  const cx = u => u / 2.05 * TW, cy = v => (1 - v / 2.25) * TH, cm = m => m / 2.05 * TW;
  const LUFF_EYES = [...Array(8)].map((_, i) => .05 + i * (1.62 - .05) / 7);
  const FOOT_EYES = [...Array(8)].map((_, i) => .055 + i * (1.965 - .055) / 7);
  const LEECH = (() => { const dx = S.peak[0] - S.clew[0], dy = S.peak[1] - S.clew[1], l = Math.hypot(dx, dy); return { d: [dx / l, dy / l], p: [dy / l, -dx / l] }; })();
  const BATTENS = [[.36, .42], [.68, .38]].map(([f, len]) => { const q = [S.clew[0] + (S.peak[0] - S.clew[0]) * f, S.clew[1] + (S.peak[1] - S.clew[1]) * f]; return { q, e: [q[0] - LEECH.p[0] * len, q[1] - LEECH.p[1] * len] }; });
  const WINDOW = [[.26, .14], [.86, .14], [.8, .52], [.32, .52]];
  // National letters on one line; numbers in two rows, starboard side uppermost (class rule 6.5)
  const SAILNO = { h: .3, stbd: { letters: [.56, 1.43], number: [.86, 1.08] }, port: { letters: [1.08, 1.43], number: [.9, .72] } };
  const BAND_V = [MAST_TOP - .635 - BOOM_Z, MAST_TOP - .610 - BOOM_Z];

  function drawSail(g, side) {
    const W = TW, H = TH, poly = [S.tack, S.clew, S.peak, S.throat];
    const trace = () => { g.beginPath(); poly.forEach(([u, v], i) => i ? g.lineTo(cx(u), cy(v)) : g.moveTo(cx(u), cy(v))); g.closePath(); };
    g.fillStyle = '#f5f5f0'; g.fillRect(0, 0, W, H);
    g.save(); trace(); g.clip();
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(120,120,110,${rnd() * .035})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1); }
    // cross-cut seams, perpendicular to the leech
    g.lineWidth = 1.2;
    for (let k = 1; k < 6; k++) {
      const q = [S.clew[0] + LEECH.d[0] * k * .46, S.clew[1] + LEECH.d[1] * k * .46];
      for (const off of [0, .014]) {
        g.strokeStyle = off ? 'rgba(150,150,140,.35)' : 'rgba(150,150,140,.55)';
        g.beginPath(); g.moveTo(cx(q[0] + LEECH.p[0] * .2 + LEECH.d[0] * off), cy(q[1] + LEECH.p[1] * .2 + LEECH.d[1] * off));
        g.lineTo(cx(q[0] - LEECH.p[0] * 3 + LEECH.d[0] * off), cy(q[1] - LEECH.p[1] * 3 + LEECH.d[1] * off)); g.stroke();
      }
    }
    // corner reinforcements
    const corner = (c, a, b, radii) => {
      for (const r of radii) {
        const a1 = Math.atan2(cy(a[1]) - cy(c[1]), cx(a[0]) - cx(c[0])), a2 = Math.atan2(cy(b[1]) - cy(c[1]), cx(b[0]) - cx(c[0]));
        let sw = a2 - a1; while (sw < 0) sw += Math.PI * 2; const ccw = sw > Math.PI;
        g.fillStyle = 'rgba(70,70,60,.045)'; g.beginPath(); g.moveTo(cx(c[0]), cy(c[1])); g.arc(cx(c[0]), cy(c[1]), cm(r), a1, a2, ccw); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(120,120,110,.4)'; g.lineWidth = 1; g.beginPath(); g.arc(cx(c[0]), cy(c[1]), cm(r) - 3, a1, a2, ccw); g.stroke();
      }
    };
    corner(S.tack, S.clew, S.throat, [.3, .2, .12]); corner(S.clew, S.peak, S.tack, [.3, .2, .12]);
    corner(S.peak, S.throat, S.clew, [.32, .21, .12]); corner(S.throat, S.tack, S.peak, [.22, .14]);
    // window
    g.fillStyle = '#a9bfcc'; g.beginPath(); WINDOW.forEach(([u, v], i) => i ? g.lineTo(cx(u), cy(v)) : g.moveTo(cx(u), cy(v))); g.closePath(); g.fill();
    const wg = g.createLinearGradient(cx(.26), cy(.52), cx(.86), cy(.14)); wg.addColorStop(0, 'rgba(255,255,255,.35)'); wg.addColorStop(.5, 'rgba(255,255,255,0)'); wg.addColorStop(1, 'rgba(255,255,255,.2)');
    g.fillStyle = wg; g.fill(); g.strokeStyle = '#e8e8e2'; g.lineWidth = cm(.018); g.stroke();
    // batten pockets with circular patches
    for (const b of BATTENS) {
      g.strokeStyle = '#e6e6df'; g.lineWidth = cm(.055); g.lineCap = 'round'; g.beginPath(); g.moveTo(cx(b.q[0]), cy(b.q[1])); g.lineTo(cx(b.e[0]), cy(b.e[1])); g.stroke();
      g.strokeStyle = 'rgba(120,120,110,.5)'; g.lineWidth = 1; for (const o of [-.026, .026]) { g.beginPath(); g.moveTo(cx(b.q[0] + LEECH.d[0] * o), cy(b.q[1] + LEECH.d[1] * o)); g.lineTo(cx(b.e[0] + LEECH.d[0] * o), cy(b.e[1] + LEECH.d[1] * o)); g.stroke(); }
      for (const r of [.07, .045]) { g.fillStyle = 'rgba(70,70,60,.05)'; g.beginPath(); g.arc(cx(b.e[0]), cy(b.e[1]), cm(r), 0, Math.PI * 2); g.fill(); }
    }
    g.restore();
    // edge tapes (tabling) with one line of stitching on the inner edge
    g.save(); trace(); g.clip();
    trace(); g.strokeStyle = 'rgba(105,105,95,.55)'; g.lineWidth = cm(.056); g.stroke();
    trace(); g.strokeStyle = '#e5e5de'; g.lineWidth = cm(.052); g.stroke();
    // luff measurement band
    g.fillStyle = '#161a1f'; g.fillRect(cx(S.tack[0]), cy(BAND_V[1]), cm(.14), cy(BAND_V[0]) - cy(BAND_V[1]));
    // sailmaker label + measurement stamp near the tack
    g.fillStyle = '#d9dcdf'; g.fillRect(cx(.13), cy(.17), cm(.16), cm(.05)); g.fillStyle = '#7d8790'; g.fillRect(cx(.145), cy(.16), cm(.09), cm(.008)); g.fillRect(cx(.145), cy(.145), cm(.12), cm(.006));
    g.strokeStyle = 'rgba(40,70,140,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(cx(.36), cy(.14), cm(.028), 0, Math.PI * 2); g.stroke();
    // telltales: red to port, green to starboard
    g.strokeStyle = side === 'port' ? '#d32f2f' : '#1f9d55'; g.lineWidth = 3; g.lineCap = 'round';
    for (const [u, v] of [[.32, .78], [.3, 1.22], [1.62, .6]]) { g.beginPath(); g.moveTo(cx(u), cy(v)); g.bezierCurveTo(cx(u + .04), cy(v + .01), cx(u + .07), cy(v - .015), cx(u + .11), cy(v - .005)); g.stroke(); }
    g.restore();
    // eyelets
    const eyelet = (u, v) => { g.fillStyle = '#aab1b8'; g.beginPath(); g.arc(cx(u), cy(v), cm(.012), 0, Math.PI * 2); g.fill(); g.fillStyle = '#39414a'; g.beginPath(); g.arc(cx(u), cy(v), cm(.0065), 0, Math.PI * 2); g.fill(); };
    LUFF_EYES.forEach(v => eyelet(.055, v)); FOOT_EYES.forEach(u => eyelet(u, .05)); eyelet(S.peak[0] - .03, S.peak[1] - .04); eyelet(S.clew[0] - .03, .05);
    // letters and number: this side bold, the other side faintly showing through.
    // Seen from starboard the texture is mirrored, so starboard print is drawn mirrored.
    const text = (str, [u, v], mirror, alpha) => {
      g.save(); g.globalAlpha = alpha; g.fillStyle = '#14202c';
      g.font = `700 ${Math.round(cm(SAILNO.h) * 1.18)}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(cx(u), cy(v)); g.scale(mirror ? -1 : 1, 1); g.fillText(str, 0, 0); g.restore();
    };
    const me = SAILNO[side], other = SAILNO[side === 'port' ? 'stbd' : 'port'], mirrorMe = side === 'stbd';
    text(SAIL_LETTERS, other.letters, !mirrorMe, .07); text(SAIL_NUMBER, other.number, !mirrorMe, .07);
    text(SAIL_LETTERS, me.letters, mirrorMe, 1); text(SAIL_NUMBER, me.number, mirrorMe, 1);
  }
  const sailTex = { port: canvasTex(TW, TH, g => drawSail(g, 'port')), stbd: canvasTex(TW, TH, g => drawSail(g, 'stbd')) };
  // The grid's front faces point to local +z (starboard with the boom centred); back faces show the port print.
  const sailMatStbd = new THREE.MeshStandardMaterial({ map: sailTex.stbd, roughness: .78, side: THREE.FrontSide, shadowSide: THREE.DoubleSide });
  const sailMatPort = new THREE.MeshStandardMaterial({ map: sailTex.port, roughness: .78, side: THREE.BackSide, shadowSide: THREE.DoubleSide });
  add(swing, 'sail', new THREE.Mesh(sailGeo, sailMatStbd)); add(swing, 'sail', new THREE.Mesh(sailGeo, sailMatPort), { shadow: false });

  const spritG = new THREE.Group(); add(swing, 'sprit', spritG);
  const halyardG = new THREE.Group(); add(swing, 'spritHalyard', halyardG);
  const vangG = new THREE.Group(); add(swing, 'vang', vangG);
  const outhaulG = new THREE.Group(); add(swing, 'outhaul', outhaulG);
  const tiesG = new THREE.Group(); add(swing, 'sailTies', tiesG);

  const SPRIT_R = .0138;
  function buildRigDetails() {
    // sprit (starboard side of the sail), end fittings and the peak loop
    clearGroup(spritG);
    const pk = sailLocal(S.peak[0], S.peak[1]);
    const heel = new V3(-SPRIT_H[0], yB + SPRIT_H[1], MAST_R + SPRIT_R + .004);
    const end = new V3(-SPRIT_P[0], yB + SPRIT_P[1], pk.z + SPRIT_R + .006);
    spritG.add(cylBetween(heel, end, SPRIT_R, MAT.alu));
    const dir = end.clone().sub(heel).normalize();
    spritG.add(cylBetween(heel.clone().addScaledVector(dir, -.01), heel.clone().addScaledVector(dir, .05), SPRIT_R + .002, MAT.black));
    spritG.add(cylBetween(end.clone().addScaledVector(dir, -.05), end.clone().addScaledVector(dir, .012), SPRIT_R + .002, MAT.black));
    spritG.add(cylBetween(end.clone().addScaledVector(dir, .01), end.clone().addScaledVector(dir, .04), .005, MAT.black));
    const loop = new THREE.Mesh(new THREE.TorusGeometry(.022, .004, 8, 20), MAT.strap); loop.position.copy(end.clone().addScaledVector(dir, .02)); loop.lookAt(loop.position.clone().add(dir)); spritG.add(loop);

    // sprit halyard: 2-part line from the mast, round a block at the sprit heel, down to a cleat
    clearGroup(halyardG);
    const blk = new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 10), MAT.black); blk.scale.set(1, 1.4, .7); blk.position.copy(heel.clone().add(new V3(0, -.03, 0))); halyardG.add(blk);
    const mA = new V3(-.005, yB + .40, MAST_R + .002), mB = new V3(.006, yB + .40, MAST_R + .001), cleat = new V3(MAST_R + .012, yB + .33, .01);
    halyardG.add(tube(polyCurve([mA, blk.position.clone().add(new V3(-.006, -.01, 0)), mB.clone().add(new V3(0, .005, 0)), cleat]), .0025, ROPE.halyard, 40));
    halyardG.add(tube([cleat, cleat.clone().add(new V3(.03, -.1, .01)), cleat.clone().add(new V3(.04, -.2, -.01))], .0025, ROPE.halyard, 16));

    // vang / boom downhaul
    clearGroup(vangG);
    const vb = new V3(-.17, yB - BOOM_R, 0), vm = new V3(-MAST_R - .002, Y(.5), 0), vc = new V3(MAST_R + .012, Y(.56), 0);
    vangG.add(tube(polyCurve([vb, vm, vm.clone().add(new V3(0, -.015, .022)), vc]), .003, ROPE.vang, 40));
    vangG.add(tube([vc, vc.clone().add(new V3(.04, -.08, .02)), vc.clone().add(new V3(.03, -.16, -.02))], .003, ROPE.vang, 16));
    const strop = new THREE.Mesh(new THREE.TorusGeometry(BOOM_R + .004, .003, 6, 20), MAT.strap); strop.rotation.y = Math.PI / 2; strop.position.set(-.17, yB, 0); vangG.add(strop);

    // outhaul
    clearGroup(outhaulG);
    const cl = sailLocal(S.clew[0] - .03, .05);
    outhaulG.add(tube(polyCurve([cl, new V3(-2.03, yB + BOOM_R + .008, 0), new V3(-1.9, yB + BOOM_R + .004, 0), new V3(-1.56, yB + BOOM_R + .012, 0)]), .0025, ROPE.outhaul, 40));
    outhaulG.add(tube([new V3(-1.53, yB + BOOM_R + .012, 0), new V3(-1.46, yB, .03), new V3(-1.44, yB - .1, .02)], .0025, ROPE.outhaul, 16));

    // sail ties at the luff and foot eyelets, and the throat lashing
    clearGroup(tiesG);
    const tl = new THREE.TorusGeometry(.034, .0025, 6, 24); tl.scale(.0425 / .034, .0265 / .034, 1); tl.rotateX(Math.PI / 2);
    for (const v of LUFF_EYES) { const m = new THREE.Mesh(tl, ROPE.tie); m.position.set(-.016, yB + v, 0); tiesG.add(m); }
    const tf = new THREE.TorusGeometry(.034, .0025, 6, 24); tf.scale(.026 / .034, .042 / .034, 1); tf.rotateY(Math.PI / 2);
    for (const u of FOOT_EYES) { const p = sailLocal(u, .05); const m = new THREE.Mesh(tf, ROPE.tie); m.position.set(-u, yB + .016, p.z * .5); tiesG.add(m); }
    const th = sailLocal(S.throat[0] + .02, S.throat[1] - .02);
    for (const dz of [.02, .12]) tiesG.add(tube(polyCurve([th, new V3(0, Y(MAST_TOP - dz), MAST_R), new V3(0, Y(MAST_TOP - dz), -MAST_R), th.clone().add(new V3(0, .005, 0))]), .002, ROPE.tie, 24));

    adopt('sprit', spritG); adopt('spritHalyard', halyardG); adopt('vang', vangG); adopt('outhaul', outhaulG); adopt('sailTies', tiesG);
  }

  // ---- invisible pick helpers for parts of the sail (edges, corners, battens, window, number area)
  const helperMat = new THREE.MeshBasicMaterial({ color: '#ff7a33', transparent: true, opacity: 0, depthWrite: false });
  helperMat.userData.helper = true;
  const helpers = {};
  for (const id of ['luff', 'leech', 'foot', 'head', 'tack', 'clew', 'throat', 'peak', 'battens', 'window', 'sailNumber']) {
    helpers[id] = new THREE.Group(); add(swing, id, helpers[id], { helper: true, noPick: id === 'sailNumber' });
  }
  function surfacePatch(poly, lift) {
    return gridGeo(10, 10, (a, b) => {
      const u = (1 - b) * ((1 - a) * poly[0][0] + a * poly[1][0]) + b * ((1 - a) * poly[3][0] + a * poly[2][0]);
      const v = (1 - b) * ((1 - a) * poly[0][1] + a * poly[1][1]) + b * ((1 - a) * poly[3][1] + a * poly[2][1]);
      const p = sailLocal(u, v); return [p.x, p.y, p.z + lift];
    });
  }
  function buildHelpers() {
    const H = (id, obj) => {
      clearGroup(helpers[id]);
      for (const o of [].concat(obj)) { o.material = helperMat; helpers[id].add(o); }
      adopt(id, helpers[id], { helper: true, noPick: id === 'sailNumber' });
    };
    const line = (fn, n, r) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...Array(n + 1)].map((_, i) => fn(i / n))), n * 2, r, 8, false));
    const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    H('luff', line(k => sailLocal(.045, S.tack[1] + (S.throat[1] - S.tack[1]) * k), 12, .014));
    H('foot', line(k => sailLocal(S.tack[0] + (S.clew[0] - S.tack[0]) * k, .045), 14, .014));
    H('leech', line(k => sailLocal(...lerp(S.clew, S.peak, k)), 20, .02));
    H('head', line(k => sailLocal(...lerp(S.throat, S.peak, k)), 16, .02));
    const ball = c => { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12)); m.position.copy(sailLocal(...c)); return m; };
    H('tack', ball([S.tack[0] + .01, S.tack[1] + .01])); H('clew', ball(S.clew)); H('throat', ball(S.throat)); H('peak', ball(S.peak));
    H('battens', BATTENS.map(b => line(k => sailLocal(...lerp(b.q, b.e, k)), 8, .018)));
    const both = poly => [new THREE.Mesh(surfacePatch(poly, .004)), new THREE.Mesh(surfacePatch(poly, -.004))];
    H('window', both(WINDOW));
    const box = (c, w, h) => [[c[0] - w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] - h / 2], [c[0] + w / 2, c[1] + h / 2], [c[0] - w / 2, c[1] + h / 2]];
    H('sailNumber', [box(SAILNO.stbd.letters, .62, .34), box(SAILNO.port.letters, .62, .34), box(SAILNO.stbd.number, .86, .34), box(SAILNO.port.number, .86, .34)].flatMap(both));
  }

  /* ---------------- blocks, mainsheet ---------------- */
  function block(r, mat = MAT.black) {
    const g = new THREE.Group();
    for (const z of [-.007, .007]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(r, r, .003, 20), mat); ch.rotation.x = Math.PI / 2; ch.position.z = z; g.add(ch); }
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(r * .78, r * .78, .011, 20), MAT.alu); sh.rotation.x = Math.PI / 2; g.add(sh);
    const sk = new THREE.Mesh(new THREE.TorusGeometry(r * .45, .0025, 6, 14), MAT.steel); sk.position.y = r + .006; g.add(sk);
    return g;
  }
  const BLOCK_A = .786, BLOCK_R = .894;   // class rule 3.2.6.1(a): floor blocks, measured from the aft transom
  const hullBlocks = new THREE.Group(); add(boat, 'blocks', hullBlocks);
  const posA = new V3(X(BLOCK_A), Y(floorZ(BLOCK_A)) + .045, 0), posR = new V3(X(BLOCK_R), Y(floorZ(BLOCK_R)) + .12, 0);
  {
    const a = block(.022); a.position.copy(posA); a.rotation.z = Math.PI; hullBlocks.add(a);
    const ap = new THREE.Mesh(new THREE.CylinderGeometry(.02, .024, .012, 18), MAT.black); ap.position.set(posA.x, Y(floorZ(BLOCK_A)) + .006, 0); hullBlocks.add(ap);
    const r = block(.032); r.position.copy(posR); r.rotation.z = Math.PI; hullBlocks.add(r);
    const spring = new THREE.Mesh(new THREE.CylinderGeometry(.013, .016, .08, 16), MAT.strap); spring.position.set(posR.x, Y(floorZ(BLOCK_R)) + .045, 0); hullBlocks.add(spring);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.03, .034, .01, 20), MAT.black); base.position.set(posR.x, Y(floorZ(BLOCK_R)) + .005, 0); hullBlocks.add(base);
    const band = new THREE.Mesh(new THREE.TorusGeometry(.032, .004, 8, 24), MAT.red); band.position.copy(posR); hullBlocks.add(band);
  }
  const BOOM_BLK = [1.45, 1.08], SHEET_END = 1.80;
  const boomBlocks = new THREE.Group(); swing.add(boomBlocks);
  for (const u of BOOM_BLK) {
    const b = block(.022); b.position.set(-u, yB - BOOM_R - .05, 0); boomBlocks.add(b);
    const st = new THREE.Mesh(new THREE.TorusGeometry(BOOM_R + .004, .003, 6, 20), MAT.strap); st.rotation.y = Math.PI / 2; st.position.set(-u, yB, 0); boomBlocks.add(st);
    boomBlocks.add(cylBetween(new V3(-u, yB - BOOM_R, 0), new V3(-u, yB - BOOM_R - .025, 0), .0025, MAT.strap));
  }
  { const st = new THREE.Mesh(new THREE.TorusGeometry(BOOM_R + .004, .003, 6, 20), MAT.strap); st.rotation.y = Math.PI / 2; st.position.set(-SHEET_END, yB, 0); boomBlocks.add(st); }
  reg('blocks', boomBlocks, { off: PART.boom.off, swing: true });   // boom blocks travel with the boom
  const sheetG = new THREE.Group(); add(boat, 'mainsheet', sheetG);

  function buildMainsheet() {
    clearGroup(sheetG);
    swing.updateMatrix();
    const boomOff = offsetOf('boom'), blkOff = offsetOf('blocks');
    const onBoom = (u, dy) => new V3(-u, yB - BOOM_R - dy, 0).applyMatrix4(swing.matrix).add(boomOff);
    const a = posA.clone().add(blkOff), r = posR.clone().add(blkOff);
    const pts = [onBoom(SHEET_END, 0), a.clone().add(new V3(.012, .018, 0)), a.clone().add(new V3(-.012, .018, 0)), onBoom(BOOM_BLK[0], .05), onBoom(BOOM_BLK[1], .05), r.clone().add(new V3(.015, .02, 0)), r.clone().add(new V3(-.02, .01, .01))];
    sheetG.add(tube(polyCurve(pts), .0042, ROPE.main, 200));
    const fl = Y(floorZ(.5)) + .006 + blkOff.y;
    const tail = [pts[pts.length - 1], new V3(X(.74), Y(.36) + blkOff.y, .16), new V3(X(.6), Y(.42) + blkOff.y, .3), new V3(X(.5), fl + .1, .26), new V3(X(.46), fl, .2), new V3(X(.52), fl, .1), new V3(X(.42), fl, .05), new V3(X(.36), fl, .12)];
    sheetG.add(tube(tail, .0042, ROPE.main, 80, 'centripetal'));
    adopt('mainsheet', sheetG);
  }

  /* ---------------- painter, daggerboard elastic, bailer, paddle, compass ---------------- */
  {
    const g = new THREE.Group(), xa = 2.04, fy = Y(floorZ(xa)) + .006, slope = Math.atan((bottomZ(2.12) - bottomZ(1.96)) / .16);
    const coil = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const tg = new THREE.TorusGeometry(.068 + i * .004, .0042, 6, 36); tg.rotateX(Math.PI / 2);
      const t = new THREE.Mesh(tg, ROPE.painter); t.position.set(Math.sin(i * 1.7) * .006, .005 + i * .0075, Math.cos(i * 1.3) * .006); coil.add(t);
    }
    coil.position.set(X(xa), fy, .14); coil.rotation.z = slope; g.add(coil);
    g.add(tube([new V3(X(xa) - .07, fy + .03, .14), new V3(X(xa) - .1, fy + .14, .08), new V3(X(MT_F) + .004, Y(MT_TOP) - .04, .05), new V3(X(MT_F) - .02, Y(MT_TOP) + .006, .05), new V3(X(MT_F) - .03, Y(MT_TOP - MT_TH) - .004, .05), new V3(X(MT_F) + .01, Y(MT_TOP - MT_TH) - .01, .06)], .0042, ROPE.painter, 48));
    add(boat, 'painter', g);
  }
  {
    const g = new THREE.Group(), xs = X(SLOT1) + .01;
    for (const side of [1, -1]) { const eye = new THREE.Mesh(new THREE.TorusGeometry(.007, .0025, 6, 12), MAT.steel); eye.position.set(xs + .02, Y(CASE_TOP) - .02, side * .034); eye.rotation.y = Math.PI / 2; g.add(eye); }
    g.add(tube([new V3(xs + .02, Y(CASE_TOP) - .02, .036), new V3(xs - .01, Y(DB_TOP) + .012, .016), new V3(xs - .03, Y(DB_TOP) + .016, 0), new V3(xs - .01, Y(DB_TOP) + .012, -.016), new V3(xs + .02, Y(CASE_TOP) - .02, -.036)], .003, ROPE.elastic, 30));
    g.add(tube([new V3(X(1.37), Y(DB_TOP) - .05, .009), new V3(X(1.5), Y(.3), .06), new V3(X(1.68), Y(.24), .05), new V3(X(MT_A) - .008, Y(.39), .03)], .0025, ROPE.lanyard, 40));
    add(boat, 'daggerboardRetainer', g);
  }
  {
    const prof = [[0, -.11], [.04, -.108], [.05, -.098], [.051, .05], [.045, .075], [.025, .095], [.017, .1], [.017, .125], [.02, .13]].map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(prof, 28, 0, Math.PI); geo.rotateZ(-Math.PI / 2);   // half a bottle: a classic bailer
    const b = new THREE.Mesh(geo, MAT.bottle);
    const xa = .58; b.position.set(X(xa), Y(floorZ(xa)) + .052, -.3); b.rotation.y = .5;
    const g = new THREE.Group(); g.add(b);
    g.add(tube([new V3(X(xa) + .12, Y(floorZ(xa)) + .09, -.24), new V3(X(.45), Y(floorZ(.45)) + .01, -.18), new V3(X(.3), Y(floorZ(.3)) + .01, -.12), new V3(X(.22), Y(floorZ(.22)) + .02, -.05)], .002, ROPE.lanyard, 30));
    add(boat, 'bailer', g);
  }
  {
    const g = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(-.12, -.075, .12, .075, .03, .03, .03, .03), { depth: .006, bevelEnabled: true, bevelThickness: .003, bevelSize: .004, bevelSegments: 2 }), MAT.yellow);
    blade.rotation.x = -Math.PI / 2; blade.position.set(.12, 0, 0); g.add(blade);
    g.add(cylBetween(new V3(0, .004, 0), new V3(-.47, .004, 0), .013, MAT.yellow));
    g.add(cylBetween(new V3(-.47, .004, -.06), new V3(-.47, .004, .06), .014, MAT.yellow));
    const xa = .7; g.position.set(X(xa), Y(floorZ(xa)) + .016, .34);
    g.rotation.set(0, -.05, -Math.atan((floorZ(.23) - floorZ(.94)) / .71) * 1.15);   // lie along the floor as it rises toward the stern
    g.add(tube([new V3(-.47, .01, .02), new V3(-.55, .02, -.05), new V3(-.62, .02, -.2), new V3(-.68, .03, -.27)], .002, ROPE.lanyard, 24));
    add(boat, 'paddle', g);
  }
  {
    const g = new THREE.Group();
    const br = new THREE.Mesh(new THREE.BoxGeometry(.012, .09, .12), MAT.black); br.position.set(X(MT_A) - .006, Y(.38), 0); g.add(br);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(.05, .055, .04, 32), MAT.black); housing.rotation.z = Math.PI / 2 - .35; housing.position.set(X(MT_A) - .035, Y(.38), 0); g.add(housing);
    const face = new THREE.Mesh(new THREE.CircleGeometry(.042, 32), new THREE.MeshStandardMaterial({ roughness: .2, map: canvasTex(256, 256, (c, w) => {
      c.fillStyle = '#10161c'; c.fillRect(0, 0, w, w); c.strokeStyle = '#e9eef2'; c.lineWidth = 3; c.translate(w / 2, w / 2);
      for (let i = 0; i < 36; i++) { c.rotate(Math.PI / 18); c.beginPath(); c.moveTo(0, -w * .44); c.lineTo(0, -w * (i % 3 === 2 ? .34 : .39)); c.stroke(); }
      c.font = '700 40px "Barlow Condensed",Arial,sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ff7a33'; c.fillText('N', 0, -w * .2);
    }) }));
    const n = new V3(-Math.sin(Math.PI / 2 - .35), Math.cos(Math.PI / 2 - .35), 0);   // housing axis: aft and up, toward the sailor
    face.position.copy(housing.position).addScaledVector(n, .0205); face.quaternion.setFromUnitVectors(new V3(0, 0, 1), n); g.add(face);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(.044, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: .18, roughness: .05 }));
    dome.position.copy(face.position); dome.quaternion.setFromUnitVectors(UP, n); g.add(dome);
    add(boat, 'compass', g);
  }

  /* ---------------- waterline footprint for the water shader ---------------- */
  const wlEnd = (() => { let x = 1.2; while (bottomZ(x) < WL && x < XC_END) x += .005; return x; })();
  const waterline = { x0: X(0), x1: X(wlEnd), hb: [...Array(48)].map((_, i) => sideHalf(wlEnd * i / 47, WL, false)) };

  /* ---------------- model API ---------------- */
  function setTrim(boomDeg, time = 0) {
    trim.phi = deg(boomDeg); trim.depth = smooth(2, 14, Math.abs(boomDeg));
    swing.rotation.y = trim.phi;
    const windSide = boomDeg < 0 ? 1 : -1;   // boom to port → wind over starboard
    vane.rotation.y = -windSide * deg(windAngleFromBoom(boomDeg));
    updateSailGeo(time); buildRigDetails(); buildHelpers(); buildMainsheet();
  }
  function anchor(id, out) {   // label positions for parts whose bounding-box centre is a poor spot
    if (id === 'mast') { out.set(X(MAST_X), Y(MAST_TOP - .35), 0).applyMatrix4(boat.matrixWorld); return true; }
    if (id === 'sail') { out.copy(sailLocal(.75, 1.0)).applyMatrix4(swing.matrixWorld); return true; }
    return false;
  }
  function redraw() { for (const k of ['port', 'stbd']) { drawSail(sailTex[k].image.getContext('2d'), k); sailTex[k].needsUpdate = true; } }

  return {
    boat, swing, waterline, floorY: -.84,
    home: { pos: new V3(4.9, 2.2, 4.5), target: new V3(-.2, .85, 0) },
    defaultBoom: -22,
    setTrim, anchor, redraw,
    update: time => updateSailGeo(time),
    onExplode: buildMainsheet,
  };
}
