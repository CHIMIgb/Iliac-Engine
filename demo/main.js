import { Engine3D } from '../engine/index.js';
import { project } from './project.js';

const canvas = document.getElementById('screen');
canvas.width = 640;
canvas.height = 480;

// Brújula (F4.7): rosa de los vientos en la esquina inferior derecha. Es un
// overlay 2D ajeno al motor (UX de la demo): muestra hacia dónde mira el
// jugador respecto al norte del mundo (-Z del espacio Three). El norte es
// también el polo de la aurora boreal (SunSystem), así se verifica la cortina.
const compass = document.createElement('canvas');
compass.width = compass.height = 96;
compass.style.cssText = 'position:fixed;right:12px;bottom:12px;width:96px;height:96px;pointer-events:none;z-index:10;';
document.body.appendChild(compass);
const cctx = compass.getContext('2d');

function drawCompass(yaw) {
  const s = 96;
  cctx.clearRect(0, 0, s, s);
  // Fondo translúcido + anillo.
  cctx.beginPath();
  cctx.arc(s / 2, s / 2, s / 2 - 2, 0, Math.PI * 2);
  cctx.fillStyle = 'rgba(30,30,46,0.55)';
  cctx.fill();
  cctx.strokeStyle = 'rgba(137,180,250,0.6)';
  cctx.lineWidth = 2;
  cctx.stroke();
  cctx.save();
  cctx.translate(s / 2, s / 2);
  // La N queda arriba cuando el jugador mira al norte (yaw = -π/2).
  cctx.rotate(Math.atan2(-Math.cos(yaw), -Math.sin(yaw)));
  // Marcas de 8 rumbos.
  cctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r1 = i % 2 === 0 ? 34 : 30;
    cctx.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
    cctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
  }
  cctx.strokeStyle = 'rgba(205,214,244,0.5)';
  cctx.lineWidth = 1.5;
  cctx.stroke();
  // Letras N/E/S/O (norte destacado en azul).
  cctx.font = 'bold 13px "Inter", sans-serif';
  cctx.textAlign = 'center';
  cctx.textBaseline = 'middle';
  const labels = [
    ['N', 0, -27, 'rgba(137,180,250,1)'],
    ['E', 27, 0, 'rgba(166,173,200,0.9)'],
    ['S', 0, 27, 'rgba(166,173,200,0.9)'],
    ['O', -27, 0, 'rgba(166,173,200,0.9)'],
  ];
  for (const [txt, x, y, col] of labels) {
    cctx.fillStyle = col;
    cctx.fillText(txt, x, y);
  }
  cctx.restore();
}

const engine = new Engine3D(project);
await engine.load(canvas);

addEventListener('resize', () => {
  engine.resize(canvas.clientWidth, canvas.clientHeight);
});

const keys = {};
let pointerLocked = false;

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

addEventListener('keydown', (e) => {
  keys[e.code] = true;
  // Pointer lock se activa automáticamente al pulsar una tecla de movimiento,
  // sin necesidad de hacer clic en el canvas.
  if (!pointerLocked && MOVE_KEYS.includes(e.code)) {
    canvas.requestPointerLock();
  }
});
addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

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

  // Rotación: solo con ratón (pointer lock).
  // Movimiento: flechas o WASD.
  let dirX = 0;
  let dirY = 0;
  if (keys['ArrowUp'] || keys['KeyW']) {
    dirX += fwdX;
    dirY += fwdY;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    dirX -= fwdX;
    dirY -= fwdY;
  }
  // Izquierda = -right, Derecha = +right
  if (keys['ArrowLeft'] || keys['KeyA']) {
    dirX -= rightX;
    dirY -= rightY;
  }
  if (keys['ArrowRight'] || keys['KeyD']) {
    dirX += rightX;
    dirY += rightY;
  }

  engine.update({ dirX, dirY, speed: moveSpeed }, dt);

  engine.render();
  drawCompass(p.yaw);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
