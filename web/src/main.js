import '@fontsource-variable/familjen-grotesk';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createRoom } from './room.js';
import { Tape } from './tape.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#room');
const hint = $('#hint');
const IN_PER_M = 39.37; // same factor as MeasureControler in the Unity scenes

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);
const controls = new OrbitControls(camera, canvas);
canvas.style.touchAction = ''; // OrbitControls sets this inline; the stylesheet decides instead
controls.enableDamping = !matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.enableZoom = false; // keep page scroll working over the stage
controls.enablePan = false;
controls.minPolarAngle = 0.6;
controls.maxPolarAngle = 1.5;
controls.minAzimuthAngle = -1;
controls.maxAzimuthAngle = 1;

const room = createRoom(scene);
const tape = new Tape();
scene.add(tape.group);

const state = { mode: 'view', item: 'sofa', metric: false, models: {}, sizes: {}, ready: false };
const xr = { session: null, source: null, hit: false, placed: false, measuring: false, start: new THREE.Vector3() };

/* ---------- readout ---------- */
const len = (m) => (state.metric ? `${(m * 100).toFixed(1)} cm` : `${(m * IN_PER_M).toFixed(1)} in`);
const num = (m) => (m * (state.metric ? 100 : IN_PER_M)).toFixed(0);

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

function refresh() {
  for (const b of document.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', b.dataset.mode === state.mode);
  for (const b of document.querySelectorAll('[data-item]')) b.setAttribute('aria-pressed', b.dataset.item === state.item);
  setText($('#unit'), state.metric ? 'Show inches' : 'Show cm');
  canvas.classList.toggle('measuring', state.mode === 'measure');
  controls.enabled = state.mode === 'view';
  for (const k in state.models) state.models[k].visible = k === state.item && (!xr.session || xr.placed);
  const s = state.sizes[state.item];
  if (!s) return;

  let value = `${num(s.x)} × ${num(s.z)} × ${num(s.y)} ${state.metric ? 'cm' : 'in'}`;
  let note = `${state.item === 'sofa' ? 'Sofa' : 'Desk'} width, depth, height`;
  if (state.mode === 'measure') {
    value = len(tape.length);
    if (tape.length === 0) note = 'Nothing measured yet';
    else if (tape.length >= s.x) note = `The ${state.item} is ${len(s.x)} wide, so it fits`;
    else note = `The ${state.item} is ${len(s.x)} wide, ${len(s.x - tape.length)} too wide`;
  }
  setText($('#value'), value);
  setText($('#note'), note);

  let tip;
  if (xr.session) {
    if (!xr.hit) tip = 'Move your phone slowly to find the floor.';
    else if (state.mode === 'view') tip = `Tap to place the ${state.item}. Tap again to move it.`;
    else tip = xr.measuring ? 'Aim at the end point and tap.' : 'Aim at the start point and tap.';
  } else if (state.mode === 'view') tip = 'Drag to look around. Tap the floor to move the furniture.';
  else tip = 'Tap and drag across the floor, wall or furniture to pull the tape.';
  setText(hint, tip);
}

/* ---------- pointer input (outside AR) ---------- */
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(e, targets) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, 1 - ((e.clientY - r.top) / r.height) * 2);
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(targets, true)[0]?.point ?? null;
}
const measurable = () => [...room.surfaces, state.models[state.item]];

let down = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!state.ready || !e.isPrimary) return;
  down = { x: e.clientX, y: e.clientY, start: null };
  if (state.mode === 'measure') {
    down.start = pick(e, measurable());
    if (down.start) canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!down?.start || !e.isPrimary) return;
  const p = pick(e, measurable());
  if (!p) return;
  tape.set(down.start, p, state.metric);
  refresh();
});
canvas.addEventListener('pointerup', (e) => {
  if (down && state.mode === 'view' && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
    const p = pick(e, [room.floor, room.surfaces[1]]);
    if (p) moveTo(p);
  }
  down = null;
});
canvas.addEventListener('pointercancel', () => { down = null; });

function moveTo(p) {
  const m = state.models[state.item];
  const s = state.sizes[state.item];
  // Keep the piece in the room whichever way it is turned.
  const c = Math.abs(Math.cos(m.rotation.y));
  const n = Math.abs(Math.sin(m.rotation.y));
  const hx = (s.x * c + s.z * n) / 2;
  const hz = (s.x * n + s.z * c) / 2;
  const { x, back, front } = room.bounds;
  m.position.set(
    THREE.MathUtils.clamp(p.x, -x + hx, x - hx),
    0,
    THREE.MathUtils.clamp(p.z, back + hz, Math.max(front - hz, back + hz)),
  );
}

/* ---------- controls ---------- */
document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
  state.mode = b.dataset.mode;
  xr.measuring = false;
  tape.clear();
  refresh();
}));
document.querySelectorAll('[data-item]').forEach((b) => b.addEventListener('click', () => {
  const prev = state.models[state.item];
  state.item = b.dataset.item;
  const next = state.models[state.item];
  if (prev && next && prev !== next) {
    if (xr.session) next.position.copy(prev.position);
    else moveTo(prev.position);
  }
  refresh();
}));
$('#unit').addEventListener('click', () => {
  state.metric = !state.metric;
  tape.redraw(state.metric);
  refresh();
});
$('#turn').addEventListener('click', () => {
  const m = state.models[state.item];
  if (!m) return;
  m.rotation.y += Math.PI / 4;
  if (!xr.session) moveTo(m.position.clone());
});

/* ---------- WebXR: tap to place, or tap two points to measure ---------- */
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.07, 0.09, 40).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0xffcb1f }),
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);
const at = new THREE.Vector3();
let saved = {};

navigator.xr?.isSessionSupported('immersive-ar').then((ok) => { $('#ar').hidden = !ok; }).catch(() => {});

$('#ar').addEventListener('click', async () => {
  if (!state.ready) return;
  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['dom-overlay'],
      domOverlay: { root: $('#overlay') },
    });
  } catch {
    hint.textContent = 'AR did not start. Allow camera access for this site and try again.';
    return;
  }
  saved = Object.fromEntries(Object.entries(state.models).map(([k, m]) => [k, m.position.clone()]));
  Object.assign(xr, { session, hit: false, placed: false, measuring: false });
  tape.clear();
  session.addEventListener('end', endAR);
  session.addEventListener('select', onSelect);
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);
  const viewer = await session.requestReferenceSpace('viewer');
  xr.source = await session.requestHitTestSource({ space: viewer });
  room.group.visible = false;
  document.body.classList.add('xr');
  $('#ar').hidden = true;
  $('#exit').hidden = false;
  refresh();
});
$('#exit').addEventListener('click', () => xr.session?.end());
// Taps on the controls must not also place furniture.
$('.dock').addEventListener('beforexrselect', (e) => e.preventDefault());

function onSelect() {
  if (!reticle.visible) return;
  at.setFromMatrixPosition(reticle.matrix);
  if (state.mode === 'view') {
    state.models[state.item].position.copy(at);
    xr.placed = true;
  } else if (!xr.measuring) {
    xr.start.copy(at);
    xr.measuring = true;
    tape.clear();
  } else {
    tape.set(xr.start, at, state.metric);
    xr.measuring = false;
  }
  refresh();
}

function endAR() {
  Object.assign(xr, { session: null, source: null, hit: false, placed: false, measuring: false });
  reticle.visible = false;
  room.group.visible = true;
  tape.clear();
  for (const k in saved) state.models[k].position.copy(saved[k]);
  document.body.classList.remove('xr');
  $('#ar').hidden = false;
  $('#exit').hidden = true;
  resize();
  refresh();
}

/* ---------- frame ---------- */
let lastAspect = 0;
function resize() {
  if (renderer.xr.isPresenting) return;
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  // Re-frame only when the shape really changes, not when a mobile URL bar slides.
  if (Math.abs(camera.aspect - lastAspect) < 0.12) return;
  lastAspect = camera.aspect;
  const tall = camera.aspect < 1;
  controls.target.set(tall ? 0 : -0.35, tall ? 0.62 : 0.72, -0.4);
  camera.position.copy(controls.target).add(new THREE.Vector3(0.36, 0.3, 1).setLength(tall ? 7.6 : 4.5));
  controls.update();
}
addEventListener('resize', resize);

renderer.setAnimationLoop((_, frame) => {
  if (frame && xr.source) {
    const pose = frame.getHitTestResults(xr.source)[0]?.getPose(renderer.xr.getReferenceSpace());
    reticle.visible = !!pose;
    if (pose) {
      const first = !xr.hit;
      xr.hit = true;
      reticle.matrix.fromArray(pose.transform.matrix);
      if (xr.measuring) {
        at.setFromMatrixPosition(reticle.matrix);
        tape.set(xr.start, at, state.metric);
      }
      if (first || xr.measuring) refresh();
    }
  } else if (!renderer.xr.isPresenting) {
    controls.update();
  }
  tape.face(renderer.xr.isPresenting ? renderer.xr.getCamera() : camera);
  renderer.render(scene, camera);
});

/* ---------- models ---------- */
// The sofa OBJ ships without materials; legs are its cylinders, 002–003 and 005–009 the soft parts.
const legMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.6 });
const cushion = new THREE.MeshStandardMaterial({ color: 0x6f8f98, roughness: 0.95 });
const frame = new THREE.MeshStandardMaterial({ color: 0x567079, roughness: 0.95 });
function sofaMaterial(name) {
  if (name.startsWith('Cylinder')) return legMat;
  return /^Cube\.?00[256789]/.test(name) ? cushion : frame;
}

async function load() {
  const loader = new GLTFLoader();
  const names = ['sofa', 'desk'];
  const files = await Promise.all(names.map((n) => loader.loadAsync(`/models/${n}.glb`)));
  files.forEach(({ scene: model }, i) => {
    const name = names[i];
    model.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = m.receiveShadow = true;
      if (name === 'sofa') m.material = sofaMaterial(m.name);
    });
    state.sizes[name] = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    const holder = new THREE.Group();
    holder.add(model);
    holder.position.set(0, 0, -0.5);
    scene.add(holder);
    state.models[name] = holder;
  });
  state.ready = true;
  refresh();
}

resize();
load().catch(() => { hint.textContent = 'The furniture did not load. Check your connection and reload the page.'; });
