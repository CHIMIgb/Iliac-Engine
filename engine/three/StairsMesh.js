import * as THREE from 'three';
import { makeMaterial } from './textures.js';

function createStepGeometry(x, y, z, width, depth, height) {
  const geo = new THREE.BoxGeometry(width, height, depth);
  geo.translate(x + width / 2, y + height / 2, z + depth / 2);
  return geo;
}

export function buildStairsMeshes(scene, world, textures) {
  for (const ramp of world.ramps || []) {
    if (ramp.type !== 'stairs') continue;

    const pos = ramp.pos || { x: 0, y: 0 };
    const dir = ramp.direction || { x: 1, y: 0 };
    const len = Math.hypot(dir.x, dir.y) || 1;
    const dx = dir.x / len;
    const dy = dir.y / len;
    const width = ramp.width ?? 1;
    const rise = ramp.rise ?? 1;
    const run = ramp.run ?? 2;
    const steps = ramp.steps ?? Math.max(1, Math.floor(run * 2));

    const stepRun = run / steps;
    const stepRise = rise / steps;
    const depth = stepRun;

    // Perpendicular para el ancho
    const perpX = -dy;
    const perpY = dx;

    for (let i = 0; i < steps; i++) {
      const centerX = pos.x + dx * (i * stepRun + stepRun / 2);
      const centerY = pos.y + dy * (i * stepRun + stepRun / 2);
      const baseX = centerX + perpX * (width / 2) - dx * (stepRun / 2);
      const baseY = centerY + perpY * (width / 2) - dy * (stepRun / 2);
      const baseZ = i * stepRise;

      const geo = createStepGeometry(baseX, baseZ, baseY, width, depth, stepRise);
      const mat = makeMaterial(textures, ramp.tex, 0xaaaaaa);
      scene.add(new THREE.Mesh(geo, mat));
    }
  }
}
