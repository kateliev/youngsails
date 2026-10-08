// Young Sails explorer — geometry and texture helpers shared by all boat models.
import * as THREE from 'three';

export const V3 = THREE.Vector3;
export const UP = new THREE.Vector3(0, 1, 0);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const deg = d => d * Math.PI / 180;

let seed = 7;
export const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// Monotone cubic interpolation (Fritsch–Carlson) through [x,y] points: smooth hull lines with no overshoot.
export function mono(pts) {
  const n = pts.length, xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return x => {
    if (x <= xs[0]) return ys[0] + m[0] * (x - xs[0]);
    if (x >= xs[n - 1]) return ys[n - 1] + m[n - 1] * (x - xs[n - 1]);
    let i = 0; while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// Parametric grid surface; `hint` = expected outward normal, used to fix triangle winding.
export function gridGeo(nu, nv, fn, hint) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uv = new Float32Array((nu + 1) * (nv + 1) * 2), idx = [];
  let k = 0, q = 0;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const p = fn(i / nu, j / nv); pos[k++] = p[0]; pos[k++] = p[1]; pos[k++] = p[2]; uv[q++] = i / nu; uv[q++] = j / nv;
  }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  if (hint) orient(g, hint);
  g.computeVertexNormals();
  return g;
}
function orient(g, hint) {
  const ix = g.index.array, p = g.attributes.position, t = Math.floor(ix.length / 6) * 3;
  const a = new V3().fromBufferAttribute(p, ix[t]), b = new V3().fromBufferAttribute(p, ix[t + 1]), c = new V3().fromBufferAttribute(p, ix[t + 2]);
  const n = b.sub(a).cross(c.sub(a));
  if (n.dot(new V3(...hint)) < 0) { for (let i = 0; i < ix.length; i += 3) { const s = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = s; } g.index.needsUpdate = true; }
}

// Sweep a closed 2D profile [out, up] along a 3D path. Profiles are counter-clockwise.
export function sweep(pts, profile, closedPath) {
  const n = pts.length, m = profile.length, pos = [], idx = [];
  for (let i = 0; i < n; i++) {
    const a = pts[closedPath ? (i - 1 + n) % n : Math.max(0, i - 1)], b = pts[closedPath ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const tan = b.clone().sub(a).normalize(), out = tan.clone().cross(UP).normalize(), up = out.clone().cross(tan).normalize();
    for (const [o, h] of profile) pos.push(pts[i].x + out.x * o + up.x * h, pts[i].y + out.y * o + up.y * h, pts[i].z + out.z * o + up.z * h);
  }
  const rings = closedPath ? n : n - 1;
  for (let i = 0; i < rings; i++) for (let j = 0; j < m; j++) {
    const i2 = (i + 1) % n, a = i * m + j, b = i * m + (j + 1) % m, c = i2 * m + j, d = i2 * m + (j + 1) % m;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
export function chaikin(pts, iters) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    const q = [];
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; q.push(a.clone().lerp(b, .25), a.clone().lerp(b, .75)); }
    p = q;
  }
  return p;
}
export function cylBetween(a, b, r, mat, seg = 16) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg, 1), mat);
  m.position.copy(a).addScaledVector(d, .5);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
export function roundRect(x0, y0, x1, y1, rBL, rBR, rTR, rTL, path) {
  const s = path || new THREE.Shape();
  s.moveTo(x0 + rBL, y0); s.lineTo(x1 - rBR, y0);
  if (rBR) s.absarc(x1 - rBR, y0 + rBR, rBR, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - rTR); if (rTR) s.absarc(x1 - rTR, y1 - rTR, rTR, 0, Math.PI / 2, false);
  s.lineTo(x0 + rTL, y1); if (rTL) s.absarc(x0 + rTL, y1 - rTL, rTL, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + rBL); if (rBL) s.absarc(x0 + rBL, y0 + rBL, rBL, Math.PI, Math.PI * 1.5, false);
  return s;
}
export function slotPath(x0, x1, hw) {
  const p = new THREE.Path();
  p.moveTo(x0 + hw, -hw); p.lineTo(x1 - hw, -hw); p.absarc(x1 - hw, 0, hw, -Math.PI / 2, Math.PI / 2, false);
  p.lineTo(x0 + hw, hw); p.absarc(x0 + hw, 0, hw, Math.PI / 2, Math.PI * 1.5, false);
  return p;
}
// Rounded-box "pillow" (superellipsoid), used for air bags.
export function pillowGeo(lx, ly, lz, e = .42) {
  const g = new THREE.SphereGeometry(1, 40, 22), p = g.attributes.position, f = a => Math.sign(a) * Math.pow(Math.abs(a), e);
  for (let i = 0; i < p.count; i++) p.setXYZ(i, f(p.getX(i)) * lx / 2, f(p.getY(i)) * ly / 2, f(p.getZ(i)) * lz / 2);
  g.computeVertexNormals(); return g;
}
export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  return t;
}

// ---- ropes
export function ropeTex(a, b) {
  const t = canvasTex(64, 32, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b;
    for (let x = -h; x < w + h; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, 0); g.lineTo(x + 6 + h * .5, h); g.lineTo(x + h * .5, h); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
export const ropeMat = (a, b) => new THREE.MeshStandardMaterial({ map: ropeTex(a, b), roughness: .85 });
// Rope tube. UVs are stretched by length so the twist pattern keeps the same pitch on every rope.
export function tube(points, r, mat, segs = 48, type = 'catmullrom') {
  const curve = points instanceof THREE.Curve ? points : new THREE.CatmullRomCurve3(points, false, type, .3);
  const g = new THREE.TubeGeometry(curve, segs, r, 7, false), uv = g.attributes.uv, k = curve.getLength() / .022;
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * k);
  return new THREE.Mesh(g, mat);
}
export function polyCurve(pts) { const c = new THREE.CurvePath(); for (let i = 0; i < pts.length - 1; i++) c.add(new THREE.LineCurve3(pts[i], pts[i + 1])); return c; }
export function clearGroup(g) { for (const c of [...g.children]) { g.remove(c); c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); } }

// Small text decal (sail numbers on foils etc.).
export function decal(text, w, h) {
  const tex = canvasTex(512, Math.round(512 * h / w), (c, W, H) => {
    c.clearRect(0, 0, W, H); c.fillStyle = '#1b2733';
    c.font = `700 ${Math.round(H * .78)}px "Barlow Condensed","Arial Narrow",Arial,sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, W / 2, H / 2 + H * .04);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .4, polygonOffset: true, polygonOffsetFactor: -2 }));
}
