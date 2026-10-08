// Young Sails explorer — part registry.
// Every mesh belongs to exactly one part id. The registry gives each part its own
// material copies so a part can glow (hover/selection) or fade on its own, keeps
// the pick list, and moves parts apart for the exploded view.
import * as THREE from 'three';
import { UP } from './geometry.js';

// partsMeta: [{ id, group, off:[x,y,z], swing?, sub?, label? }] — see models/<boat>/parts.js
export function createRegistry(partsMeta, state) {
  const PART = Object.fromEntries(partsMeta.map((p, i) => [p.id, { ...p, index: i }]));
  const partObjs = {}, partMats = {}, matCache = {}, pickables = [], explodables = [];
  const ACC = new THREE.Color('#ff6a1a'), BLACK = new THREE.Color(0);
  let pivot = null;   // the group that swings round the mast (boom, sail …)

  // Give every mesh under obj the part id and a per-part material.
  // Call again for groups whose children are rebuilt at runtime (ropes, sail helpers).
  function adopt(id, obj, o = {}) {
    const cache = (matCache[id] ||= new Map());
    const swap = mt => {
      if (!cache.has(mt)) {
        const c = mt.clone();
        c.userData = { ...mt.userData, baseOpacity: mt.opacity, baseTransparent: mt.transparent, baseDepthWrite: mt.depthWrite };
        cache.set(mt, c); (partMats[id] ||= []).push(c);
      }
      return cache.get(mt);
    };
    obj.traverse(m => {
      if (!m.isMesh) return;
      m.userData.part = id;
      if (!m.userData.adopted) {
        m.material = Array.isArray(m.material) ? m.material.map(swap) : swap(m.material);
        if (!o.noPick) pickables.push(m);
        if (o.helper) m.renderOrder = 5; else { m.castShadow = o.shadow !== false; m.receiveShadow = true; }
        m.userData.adopted = true;
      }
    });
    for (let i = pickables.length - 1; i >= 0; i--) if (!pickables[i].parent) pickables.splice(i, 1);   // drop rebuilt meshes
  }
  function reg(id, obj, o = {}) {
    const P = PART[id]; if (!P) { console.warn('unknown part', id); return obj; }
    adopt(id, obj, o);
    (partObjs[id] ||= []).push(obj);
    explodables.push({ obj, base: obj.position.clone(), off: new THREE.Vector3(...(o.off || P.off || [0, 0, 0])), swing: o.swing ?? !!P.swing });
    return obj;
  }
  const add = (parent, id, obj, o) => { parent.add(obj); return reg(id, obj, o); };
  const offsetOf = id => new THREE.Vector3(...(PART[id].off || [0, 0, 0])).multiplyScalar(state.explode);

  function applyExplode() {
    for (const ex of explodables) {
      const off = ex.off.clone().multiplyScalar(state.explode);
      if (ex.swing && pivot) off.applyAxisAngle(UP, -pivot.rotation.y);
      ex.obj.position.copy(ex.base).add(off);
    }
  }

  // Hover and selection glow; with state.ghost the unselected parts fade out.
  function applyLook() {
    const sel = state.selected, hov = state.hover, selPart = sel && PART[sel];
    for (const id in partMats) {
      const P = PART[id], hl = id === sel || id === hov;
      const keepSail = selPart && selPart.group === 'sail' && sel !== 'sail' && id === 'sail';   // a sail detail is selected: keep the sail half-visible
      const fade = state.ghost && sel && !hl && !(sel === 'sail' && P.group === 'sail' && P.sub);
      for (const m of partMats[id]) {
        if (m.userData.helper) { m.opacity = hl ? (id === hov && id !== sel ? .55 : .85) : 0; continue; }
        if (m.emissive) { m.emissive.copy(hl ? ACC : BLACK); m.emissiveIntensity = hl ? (id === sel ? .42 : .28) : 0; }
        const tr = fade || m.userData.baseTransparent;
        if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
        m.opacity = fade ? (keepSail ? .55 : .13) : m.userData.baseOpacity;
        m.depthWrite = fade ? false : m.userData.baseDepthWrite;
      }
    }
  }
  function paint(color) { for (const id in partMats) for (const m of partMats[id]) if (m.userData.paint) m.color.set(color); }

  return { PART, partObjs, partMats, pickables, reg, adopt, add, offsetOf, applyExplode, applyLook, paint, setPivot: p => { pivot = p; } };
}
