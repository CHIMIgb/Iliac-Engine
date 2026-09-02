import { Engine3D, getSectorAt, getFloorHeightAt } from '../engine/index.js';
import { project } from './project-sector.js';

const canvas = document.getElementById('screen');
canvas.width = 640;
canvas.height = 480;

const engine = new Engine3D(project);
await engine.load(canvas);

const keys = {};
let pointerLocked = false;

addEventListener('keydown', (e) => (keys[e.key] = true));
addEventListener('keyup', (e) => (keys[e.key] = false));

canvas.addEventListener('click', () => canvas.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
});
document.addEventListener('mousemove', (e) => {
  if (!pointerLocked) return;
  engine.player.rotateYaw(e.movementX * 0.002);
  engine.player.rotatePitch(-e.movementY * 0.002);
});

const rotSpeed = 2.5;
const moveSpeed = 3.0;
let last = performance.now();

function updatePlayerOnFloor(p, dt) {
  const sector = getSectorAt(project.world, p.posX, p.posY);
  if (sector) {
    const floorH = getFloorHeightAt(project.world, sector, p.posX, p.posY);
    const targetZ = floorH + p.eyeHeight;
    // Seguimiento suave del suelo
    const factor = Math.min(1, 10 * dt);
    p.posZ += (targetZ - p.posZ) * factor;
  }
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const p = engine.player;
  const fwdX = Math.cos(p.yaw);
  const fwdY = Math.sin(p.yaw);
  const rightX = Math.cos(p.yaw + Math.PI / 2);
  const rightY = Math.sin(p.yaw + Math.PI / 2);

  if (keys['ArrowLeft']) p.rotateYaw(-rotSpeed * dt);
  if (keys['ArrowRight']) p.rotateYaw(rotSpeed * dt);
  if (keys['ArrowUp'] || keys['KeyW']) {
    p.posX += fwdX * moveSpeed * dt;
    p.posY += fwdY * moveSpeed * dt;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    p.posX -= fwdX * moveSpeed * dt;
    p.posY -= fwdY * moveSpeed * dt;
  }
  if (keys['KeyA']) {
    p.posX += rightX * moveSpeed * dt;
    p.posY += rightY * moveSpeed * dt;
  }
  if (keys['KeyD']) {
    p.posX -= rightX * moveSpeed * dt;
    p.posY -= rightY * moveSpeed * dt;
  }

  updatePlayerOnFloor(p, dt);

  engine.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
