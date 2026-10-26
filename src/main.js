import * as THREE from 'three';
import { TRACKS } from './tracks.js';
import { Race } from './race.js';
import { Input } from './input.js';
import { AudioFX } from './audio.js';
import { UI } from './ui.js';

const input = new Input();
const audio = new AudioFX();
const ui = new UI();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 8, -14);

const hemi = new THREE.HemisphereLight(0xffffff, 0x445544, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

let race = null;
let state = 'menu';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function applyEnvironment(def) {
  scene.background = new THREE.Color(def.sky);
  scene.fog = new THREE.Fog(def.fog, 140, 480);
  sun.color.set(def.sun);
  hemi.color.set(def.sky);
}

function setupSun(def) {
  const pts = def.points.map((p) => p);
  let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
  for (const [x, z] of pts) {
    minx = Math.min(minx, x); maxx = Math.max(maxx, x);
    minz = Math.min(minz, z); maxz = Math.max(maxz, z);
  }
  const cx = (minx + maxx) / 2, cz = (minz + maxz) / 2;
  const ext = Math.max(maxx - minx, maxz - minz) / 2 + 90;
  sun.position.set(cx + 90, 170, cz + 60);
  sun.target.position.set(cx, 0, cz);
  const cam = sun.shadow.camera;
  cam.left = -ext; cam.right = ext; cam.top = ext; cam.bottom = -ext;
  cam.near = 10; cam.far = 600;
  cam.updateProjectionMatrix();
}

function startRace(trackIdx) {
  audio.init();
  audio.startEngine();
  if (race) {
    race.dispose();
    race = null;
  }
  const def = TRACKS[trackIdx];
  applyEnvironment(def);
  setupSun(def);
  race = new Race(scene, def, input, audio, ui);
  ui.beginRace(race);
  state = 'racing';
  camera.fov = 65;
  camera.updateProjectionMatrix();
}

function toMenu() {
  if (race) {
    race.dispose();
    race = null;
  }
  audio.stopEngine();
  scene.background = new THREE.Color(0x101822);
  scene.fog = null;
  state = 'menu';
  ui.showMenu(TRACKS, startRace);
}

ui.showMenu(TRACKS, startRace);

const camTarget = new THREE.Vector3();
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (input.consumeAction('menu') && state !== 'menu') toMenu();
  if (input.consumeAction('restart') && state === 'racing' && race) {
    startRace(TRACKS.indexOf(race.trackDef));
  }

  if (race && state !== 'menu') {
    race.update(dt);
    const p = race.player;
    const f = p.forward();
    const behind = 9 + Math.min(4, Math.abs(p.speed()) * 0.06);
    const desired = new THREE.Vector3(
      p.pos.x - f.x * behind,
      4.2,
      p.pos.z - f.z * behind
    );
    const k = 1 - Math.exp(-7 * dt);
    camera.position.lerp(desired, k);
    camTarget.set(p.pos.x + f.x * 4, 1.2, p.pos.z + f.z * 4);
    camera.lookAt(camTarget);
    const boosting = p.boostTimer > 0;
    const targetFov = boosting ? 78 : 65;
    camera.fov += (targetFov - camera.fov) * Math.min(1, 8 * dt);
    camera.updateProjectionMatrix();
  }

  renderer.render(scene, camera);
}
animate();

document.getElementById('again-btn').addEventListener('click', () => {
  if (race) startRace(TRACKS.indexOf(race.trackDef));
});
document.getElementById('menu-btn').addEventListener('click', toMenu);

// small console debug hook: window.__game() -> { race, state }
window.__game = () => ({ race, state });
