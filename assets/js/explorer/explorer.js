// Young Sails explorer — entry point. A class page calls:
//   startExplorer({ createModel, parts, groups, paints, ns: 'optimist' })
// createModel({ registry }) must return:
//   { boat, swing, waterline:{x0,x1,hb[]}, floorY, home:{pos,target,tallDrop?}, defaultBoom,
//     setTrim(boomDeg, time), update(time), onExplode(), anchor?(id, v3), redraw?(), shadowSize? }
// shadowSize (optional): half-size in metres of the sun's shadow box (default 4).
// home.tallDrop (optional): how far the camera target drops on tall (phone) screens (default 0.75 m).
import * as THREE from 'three';
import { pickLang, pickGloss, loadStrings, loadRaw, t } from '../core/i18n.js';
import { createStage } from './stage.js';
import { createRegistry } from './registry.js';
import { createUI } from './ui.js';
import { displayFont } from './geometry.js';

export async function startExplorer({ createModel, parts, groups, paints, ns }) {
  const lang = pickLang(), glossLang = pickGloss(lang);
  document.documentElement.lang = lang;
  // Load the display font before the model draws its sail numbers and decals onto canvases
  // (capped wait; model.redraw() repaints the sail again once all fonts are in).
  const fontReady = Promise.race([document.fonts?.load(`700 40px ${displayFont()}`).catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
  const [S, M, G] = await Promise.all([loadStrings('common', lang), loadStrings(ns, lang), loadRaw(ns, glossLang), fontReady]);
  if (G) G._lang = glossLang;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { explode: 0, explodeTarget: 0, selected: null, hover: null, ghost: true, mode: 'water', labels: false };
  const stage = createStage(document.getElementById('scene'));
  const registry = createRegistry(parts, state);
  const model = createModel({ registry });
  stage.scene.add(model.boat);
  stage.setWaterline(model.waterline);
  stage.setFloor(model.floorY);
  if (model.shadowSize) stage.setShadowSize(model.shadowSize);

  const ui = createUI({ stage, registry, model, state, S, M, G, parts, groups, paints, lang });
  ui.setTrim(model.defaultBoom, 0);

  const clock = new THREE.Clock();
  const { renderer, scene, camera, controls } = stage, boat = model.boat;
  function frame() {
    const dt = Math.min(clock.getDelta(), .05), time = clock.elapsedTime;
    if (state.mode === 'water' && !reduceMotion) {
      boat.position.y = Math.sin(time * 1.3) * .012;
      boat.rotation.x = Math.sin(time * .9) * .018 + Math.sin(time * 2.1) * .005;
      boat.rotation.z = Math.sin(time * .7 + 1) * .01;
    }
    boat.updateMatrixWorld();
    stage.tick(time, boat);
    if (!reduceMotion) model.update(time);
    if (state.explode !== state.explodeTarget) {
      state.explode += (state.explodeTarget - state.explode) * (reduceMotion ? 1 : Math.min(1, dt * 3.2));
      if (Math.abs(state.explode - state.explodeTarget) < .002) state.explode = state.explodeTarget;
      registry.applyExplode(); model.onExplode(); registry.applyLook();
    }
    ui.tweenStep(dt);
    controls.update();
    ui.processHover();
    renderer.render(scene, camera);
    ui.updateLabels();
    requestAnimationFrame(frame);
  }
  document.getElementById('loading')?.remove();
  frame();
  document.fonts?.ready.then(() => model.redraw?.());

  // Handle for later stages (lessons, quizzes) and for debugging from the console.
  window.youngsails = { THREE, stage, registry, model, state, ui, strings: { S, M, G }, t };
  return window.youngsails;
}
