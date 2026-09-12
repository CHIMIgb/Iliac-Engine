/**
 * demo/audio — vitrina del Audio Engine (F4.5). No contiene lógica de juego:
 * solo muestra la API (loops simultáneos, espacial 3D, SFX con variación,
 * ducking bajo voz e intensidad de música adaptativa). Los WAVs los genera
 * `npm run setup:audio` (no versionados).
 */
import { Engine3D } from '../../engine/index.js';
import { project } from './project.js';

const canvas = document.getElementById('screen');
canvas.width = 640;
canvas.height = 480;

const engine = new Engine3D(project);
await engine.load(canvas);
engine.resumeAudio(); // el navegador lo mantiene en silencio hasta el primer gesto

addEventListener('resize', () => {
  engine.resize(canvas.clientWidth, canvas.clientHeight);
});

const keys = {};
let pointerLocked = false;
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Pasos: un footstep cada ~1.2 m andados (el motor ya varía pitch/volumen/muestra).
const STEP_DIST = 1.2;
let stepAccum = 0;
let lastX = project.camera.posX;
let lastY = project.camera.posY;
let intensity = project.music.intensity ?? 0;
let musicMuted = false;

const hud = document.getElementById('int');
const setHud = () => { hud.textContent = musicMuted ? 'mudo' : String(intensity); };

addEventListener('click', () => {
  canvas.requestPointerLock();
  engine.resumeAudio(); // gesto → desbloqueo real del AudioContext
});

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (!pointerLocked && MOVE_KEYS.includes(e.code)) canvas.requestPointerLock();

  const a = engine.audio;
  if (!a) return;
  const p = engine.player;
  switch (e.code) {
    case 'Digit1': case 'Digit2': case 'Digit3':
      intensity = Number(e.code.slice(5)) - 1;
      engine.music?.setIntensity(intensity);
      setHud();
      break;
    case 'KeyF': a.playSfx('door', { x: p.posX, y: p.posY, z: p.posZ }); break;
    case 'KeyH': a.playSfx('hit', { x: p.posX, y: p.posY, z: p.posZ }); break;
    case 'KeyV':
      a.playSfx('voice');
      a.duckMusic(true);
      setTimeout(() => a.duckMusic(false), 900); // la voz "termina" tras su longitud
      break;
    case 'KeyM':
      musicMuted = !musicMuted;
      a.setBusVolume('music', musicMuted ? 0 : 1);
      setHud();
      break;
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  engine.player.rotateYaw(e.movementX * 0.002);
  engine.player.rotatePitch(-e.movementY * 0.002);
});

const moveSpeed = 3.0;
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const p = engine.player;
  const fwdX = Math.cos(p.yaw);
  const fwdY = Math.sin(p.yaw);
  const rightX = Math.cos(p.yaw + Math.PI / 2);
  const rightY = Math.sin(p.yaw + Math.PI / 2);

  let dirX = 0;
  let dirY = 0;
  if (keys['ArrowUp'] || keys['KeyW']) { dirX += fwdX; dirY += fwdY; }
  if (keys['ArrowDown'] || keys['KeyS']) { dirX -= fwdX; dirY -= fwdY; }
  if (keys['ArrowLeft'] || keys['KeyA']) { dirX -= rightX; dirY -= rightY; }
  if (keys['ArrowRight'] || keys['KeyD']) { dirX += rightX; dirY += rightY; }

  engine.update({ dirX, dirY, speed: moveSpeed }, dt);

  if (dirX || dirY) {
    stepAccum += Math.hypot(p.posX - lastX, p.posY - lastY);
    if (stepAccum >= STEP_DIST) {
      stepAccum = 0;
      engine.audio?.playSfx('footstep');
    }
  } else {
    stepAccum = STEP_DIST; // al volver a andar no suena paso inmediato
  }
  lastX = p.posX;
  lastY = p.posY;

  engine.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
