import { Raycaster } from '../engine/index.js';
import { project } from './project.js';

const canvas = document.getElementById('screen');
canvas.width = 640;
canvas.height = 480;

const engine = new Raycaster(project);

const keys = {};
addEventListener('keydown', (e) => (keys[e.key] = true));
addEventListener('keyup', (e) => (keys[e.key] = false));

const rotSpeed = 2.5;
const moveSpeed = 3.0;
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  if (keys['ArrowLeft']) engine.camera.rotate(-rotSpeed * dt);
  if (keys['ArrowRight']) engine.camera.rotate(rotSpeed * dt);
  if (keys['ArrowUp'] || keys['KeyW']) engine.camera.move(engine.world.map, true, moveSpeed, dt);
  if (keys['ArrowDown'] || keys['KeyS']) engine.camera.move(engine.world.map, false, moveSpeed, dt);

  engine.renderSimple(canvas);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);