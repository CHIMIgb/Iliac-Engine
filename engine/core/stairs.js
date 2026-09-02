function normalizeDir(dir) {
  const len = Math.hypot(dir.x, dir.y) || 1;
  return { x: dir.x / len, y: dir.y / len };
}

export function getStairHeightAt(world, x, y) {
  for (const ramp of world.ramps || []) {
    if (ramp.type !== 'stairs') continue;
    const h = getStairHeightAtRamp(ramp, x, y);
    if (h !== null) return h;
  }
  return null;
}

function getStairHeightAtRamp(ramp, x, y) {
  const pos = ramp.pos || { x: 0, y: 0 };
  const dir = normalizeDir(ramp.direction || { x: 1, y: 0 });
  const perp = { x: -dir.y, y: dir.x };
  const width = ramp.width ?? 1;
  const rise = ramp.rise ?? 1;
  const run = ramp.run ?? 2;
  const steps = ramp.steps ?? Math.max(1, Math.floor(run * 2));
  const stepRun = run / steps;

  const lx = x - pos.x;
  const ly = y - pos.y;
  const along = lx * dir.x + ly * dir.y;
  const across = lx * perp.x + ly * perp.y;

  if (across < -1e-6 || across > width + 1e-6) return null;
  if (along < -1e-6 || along > run + 1e-6) return null;

  const stepIndex = Math.min(steps - 1, Math.floor(along / stepRun));
  return stepIndex * (rise / steps);
}

export function getStairSegments(ramp) {
  const segments = [];
  if (ramp.type !== 'stairs') return segments;

  const pos = ramp.pos || { x: 0, y: 0 };
  const dir = normalizeDir(ramp.direction || { x: 1, y: 0 });
  const perp = { x: -dir.y, y: dir.x };
  const width = ramp.width ?? 1;
  const run = ramp.run ?? 2;
  const steps = ramp.steps ?? Math.max(1, Math.floor(run * 2));
  const stepRun = run / steps;

  for (let i = 0; i < steps; i++) {
    const baseX = pos.x + dir.x * i * stepRun;
    const baseY = pos.y + dir.y * i * stepRun;

    // Cara frontal del peldaño (borde inferior en dirección de subida)
    const fx = baseX;
    const fy = baseY;
    const a = { x: fx + perp.x * width, y: fy + perp.y * width };
    const b = { x: fx - perp.x * width, y: fy - perp.y * width };
    segments.push({ a, b, stepIndex: i, ramp });
  }

  return segments;
}
