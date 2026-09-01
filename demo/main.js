import { Engine3D, moveWithCollision } from '../engine/index.js';
import { project } from './project.js';

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
  if (keys['ArrowUp'] || keys['KeyW']) moveWithCollision(p, engine.world.map, fwdX, fwdY, moveSpeed, dt);
  if (keys['ArrowDown'] || keys['KeyS']) moveWithCollision(p, engine.world.map, -fwdX, -fwdY, moveSpeed, dt);
  if (keys['KeyA']) moveWithCollision(p, engine.world.map, rightX, rightY, moveSpeed, dt);
  if (keys['KeyD']) moveWithCollision(p, engine.world.map, -rightX, -rightY, moveSpeed, dt);

  engine.update(dt);
  engine.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
