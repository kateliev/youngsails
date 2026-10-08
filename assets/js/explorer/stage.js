// Young Sails explorer — the stage: renderer, camera, sky, light, water, scenery, studio.
// Boat-agnostic: a model plugs in its own waterline footprint and floor height.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { canvasTex, rnd } from './geometry.js';

export const COL = { top: '#2c82cf', mid: '#8fc9ee', horizon: '#d6ecf8', deep: '#0b4c70', shallow: '#1d88ad', skyRefl: '#a7d6f1', seabed: '#0e5677' };
const HB_N = 32;   // waterline samples passed to the water shader

export function createStage(canvas) {
  THREE.ColorManagement.legacyMode = false;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .05, 2000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.minDistance = .8; controls.maxDistance = 20; controls.maxPolarAngle = 1.62;
  controls.autoRotateSpeed = .6;

  // ---- sky (also the image-based light, so metal and gloss reflect it)
  const SUN = new THREE.Vector3(5, 8, 4.5).normalize();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(COL.top) }, mid: { value: new THREE.Color(COL.mid) }, bottom: { value: new THREE.Color(COL.horizon) }, sunDir: { value: SUN } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top, mid, bottom, sunDir; varying vec3 vDir;
      void main(){
        float h = vDir.y;
        vec3 c = mix(mid, top, pow(clamp(h,0.0,1.0), 0.55));
        c = mix(bottom, c, smoothstep(-0.01, 0.16, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += vec3(1.0,0.93,0.78) * (pow(s, 900.0) * 6.0 + pow(s, 14.0) * 0.16);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), skyMat);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), skyMat.clone()));
  const envGround = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), new THREE.MeshBasicMaterial({ color: '#2f6f8f' }));
  envGround.rotation.x = -Math.PI / 2; envGround.position.y = -1.5; envScene.add(envGround);
  scene.environment = pmrem.fromScene(envScene, .04).texture;

  scene.add(new THREE.HemisphereLight('#dff1ff', '#2c5d74', .35));
  const sun = new THREE.DirectionalLight('#fff3df', 2.1);
  sun.position.copy(SUN).multiplyScalar(14);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 2, far: 30 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);
  const fog = new THREE.Fog(COL.horizon, 70, 420);
  scene.fog = fog;

  // ---- water: see-through near the boat so foils stay visible; hidden inside the hull footprint
  const waterUniforms = {
    uTime: { value: 0 }, uDeep: { value: new THREE.Color(COL.deep) }, uShallow: { value: new THREE.Color(COL.shallow) },
    uSkyC: { value: new THREE.Color(COL.skyRefl) }, uHorizon: { value: new THREE.Color(COL.horizon) }, uSun: { value: SUN },
    uBoatInv: { value: new THREE.Matrix4() }, uHB: { value: new Array(HB_N).fill(0) }, uX0: { value: 0 }, uX1: { value: 0 },
  };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600, 1, 1), new THREE.ShaderMaterial({
    uniforms: waterUniforms, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uDeep, uShallow, uSkyC, uHorizon, uSun; uniform mat4 uBoatInv; uniform float uHB[${HB_N}]; uniform float uX0, uX1;
      varying vec3 vW;
      float hbAt(float x){
        float f = clamp((x - uX0) / max(uX1 - uX0, 1e-4), 0.0, 1.0) * ${HB_N - 1}.0; int i = int(floor(f)); int j = i + 1; if (j > ${HB_N - 1}) j = ${HB_N - 1};
        float a = 0.0, b = 0.0;
        for (int k = 0; k < ${HB_N}; k++) { if (k == i) a = uHB[k]; if (k == j) b = uHB[k]; }
        return mix(a, b, fract(f));
      }
      vec2 wv(vec2 p, vec2 d, float k, float a, float s){ return d * (a * k * cos(dot(p, d) * k + uTime * s)); }
      void main(){
        vec3 bl = (uBoatInv * vec4(vW, 1.0)).xyz;
        float inX = step(uX0, bl.x) * step(bl.x, uX1);
        float dz = abs(bl.z) - hbAt(bl.x);
        if (inX > 0.5 && dz < -0.003) discard;
        float dx = max(uX0 - bl.x, bl.x - uX1);
        float d = inX > 0.5 ? dz : length(max(vec2(dx, dz), 0.0));
        vec2 p = vW.xz;
        vec2 g = wv(p, normalize(vec2(1.0, .35)), 1.25, .03, 1.1) + wv(p, normalize(vec2(-.45, 1.0)), 2.2, .014, 1.7)
               + wv(p, normalize(vec2(.7, -.8)), 4.9, .005, 2.4) + wv(p, normalize(vec2(-.9, -.25)), 9.7, .0022, 3.3)
               + wv(p, normalize(vec2(.25, .95)), 18.0, .0009, 4.6) + wv(p, normalize(vec2(.95, .1)), 31.0, .0004, 6.0);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 V = normalize(cameraPosition - vW);
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 col = mix(uShallow, uDeep, smoothstep(0.15, 1.0, ndv));
        col = mix(col, uSkyC, fres * 0.85);
        vec3 R = reflect(-V, n);
        col += vec3(1.0, 0.95, 0.82) * (pow(max(dot(R, uSun), 0.0), 220.0) * 2.4 + pow(max(dot(R, uSun), 0.0), 24.0) * 0.08);
        float foam = (1.0 - smoothstep(0.0, 0.07, d)) * (0.6 + 0.4 * sin(uTime * 2.3 + bl.x * 23.0 + bl.z * 13.0));
        col = mix(col, vec3(0.94, 0.97, 1.0), foam * 0.7);
        col = mix(col, uHorizon, smoothstep(40.0, 420.0, length(vW.xz)));
        float a = mix(0.56, 1.0, smoothstep(1.4, 7.0, length(vW.xz)));
        a = max(a, foam * 0.75);
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }`,
  }));
  water.rotation.x = -Math.PI / 2; water.renderOrder = 2; scene.add(water);
  const seabed = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshBasicMaterial({ color: COL.seabed }));
  seabed.rotation.x = -Math.PI / 2; seabed.position.y = -5; scene.add(seabed);

  // ---- distant islands, clouds and two race marks
  const scenery = new THREE.Group(); scene.add(scenery);
  const land = new THREE.MeshStandardMaterial({ color: '#5f9a5a', flatShading: true, roughness: .9 });
  const rock = new THREE.MeshStandardMaterial({ color: '#c9b98d', flatShading: true, roughness: 1 });
  for (const [x, z, r, h] of [[-90, -150, 28, 11], [70, -190, 40, 16], [210, -60, 34, 10], [-210, 60, 46, 18], [40, 240, 30, 9], [-120, 220, 22, 7]]) {
    const g = new THREE.IcosahedronGeometry(1, 1); g.scale(r, h, r * .75);
    const m = new THREE.Mesh(g, land); m.position.set(x, -h * .35, z); m.rotation.y = rnd() * 6; scenery.add(m);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.15, 1.2, 9), rock); b.position.set(x, -.3, z); b.scale.z = .78; scenery.add(b);
  }
  const cloud = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, emissive: '#ffffff', emissiveIntensity: .35, fog: false });
  for (const [x, y, z, s] of [[-160, 70, -320, 1], [120, 85, -360, 1.3], [320, 60, -80, .9], [-330, 90, 120, 1.2]]) {
    const g = new THREE.Group();
    for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(10 + rnd() * 9, 1), cloud); m.position.set((i - 2.5) * 13 + rnd() * 6, rnd() * 7, rnd() * 10); g.add(m); }
    g.position.set(x, y, z); g.scale.setScalar(s); scenery.add(g);
  }
  const marks = [];
  for (const [x, z, c] of [[-24, -20, '#ff6a1a'], [26, -14, '#f2c12e']]) {
    const g = new THREE.Group(), mat = new THREE.MeshStandardMaterial({ color: c, roughness: .5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, 1.1, 18), mat); body.position.y = .35; g.add(body);
    const top = new THREE.Mesh(new THREE.ConeGeometry(.45, .5, 18), mat); top.position.y = 1.15; g.add(top);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(.47, .5, .14, 18), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .5 })); band.position.y = .55; g.add(band);
    g.position.set(x, 0, z); scenery.add(g); marks.push(g);
  }

  // ---- studio: plain floor with a soft shadow
  const studio = new THREE.Group(); studio.visible = false; scene.add(studio);
  const shadowFloor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.ShadowMaterial({ opacity: .2 }));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.receiveShadow = true; studio.add(shadowFloor);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: canvasTex(512, 512, (c, w) => {
    const gr = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, w);
    c.strokeStyle = 'rgba(40,80,110,.18)'; c.lineWidth = 2; for (const r of [.2, .32, .44]) { c.beginPath(); c.arc(w / 2, w / 2, w * r, 0, Math.PI * 2); c.stroke(); }
  }) }));
  disc.rotation.x = -Math.PI / 2; studio.add(disc);

  // Model hooks
  function setWaterline({ x0, x1, hb }) {   // boat-local x range and half-breadths at the waterline
    waterUniforms.uX0.value = x0; waterUniforms.uX1.value = x1;
    const out = waterUniforms.uHB.value;
    for (let i = 0; i < HB_N; i++) { const f = i / (HB_N - 1) * (hb.length - 1), a = Math.floor(f), b = Math.min(a + 1, hb.length - 1); out[i] = hb[a] + (hb[b] - hb[a]) * (f - a); }
  }
  function setFloor(y) { shadowFloor.position.y = y; disc.position.y = y - .002; }
  function setShadowSize(r) {   // half-size of the sun's shadow box: bigger boats need more, small boats keep the detail
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r }); sun.shadow.camera.updateProjectionMatrix();
  }
  function setMode(mode, stageColor) {
    const w = mode === 'water';
    water.visible = scenery.visible = sky.visible = seabed.visible = w; studio.visible = !w;
    scene.fog = w ? fog : null;
    scene.background = w ? null : new THREE.Color(stageColor || '#d3e8f5');
    controls.maxPolarAngle = w ? 1.62 : 1.78;
  }
  function tick(t, boat) {
    waterUniforms.uTime.value = t;
    waterUniforms.uBoatInv.value.copy(boat.matrixWorld).invert();
    marks.forEach((m, i) => { m.position.y = Math.sin(t * 1.1 + i * 2) * .06; m.rotation.z = Math.sin(t * .8 + i) * .06; });
  }

  return { renderer, scene, camera, controls, setWaterline, setFloor, setShadowSize, setMode, tick };
}
