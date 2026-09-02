import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNoise, fbm2 } from '../../engine/core/noise.js';

// --- simplex2 ---

test('simplex2 devuelve valores en rango [-1, 1]', () => {
  const { simplex2 } = createNoise(42);
  for (let i = 0; i < 200; i++) {
    const x = (Math.random() - 0.5) * 100;
    const y = (Math.random() - 0.5) * 100;
    const v = simplex2(x, y);
    assert.ok(v >= -1 && v <= 1, `valor ${v} fuera de rango para (${x}, ${y})`);
  }
});

test('simplex2 es determinista (misma seed = mismos valores)', () => {
  const n1 = createNoise(123);
  const n2 = createNoise(123);
  for (let i = 0; i < 50; i++) {
    const x = i * 0.73;
    const y = i * 1.31;
    assert.equal(n1.simplex2(x, y), n2.simplex2(x, y));
  }
});

test('seeds distintas producen resultados distintos', () => {
  const n1 = createNoise(1);
  const n2 = createNoise(999);
  let diffs = 0;
  for (let i = 0; i < 20; i++) {
    if (n1.simplex2(i, i) !== n2.simplex2(i, i)) diffs++;
  }
  assert.ok(diffs > 10, 'la mayoría de valores deben diferir entre seeds');
});

test('simplex2 varía suavemente (continuidad)', () => {
  const { simplex2 } = createNoise(7);
  const step = 0.01;
  let maxDelta = 0;
  for (let x = 0; x < 5; x += step) {
    const v0 = simplex2(x, 0);
    const v1 = simplex2(x + step, 0);
    maxDelta = Math.max(maxDelta, Math.abs(v1 - v0));
  }
  // Para un step de 0.01, las diferencias deben ser pequeñas
  assert.ok(maxDelta < 0.1, `diferencia máxima ${maxDelta} demasiado grande para step ${step}`);
});

test('simplex2(0, 0) devuelve un valor numérico finito', () => {
  const { simplex2 } = createNoise(0);
  const v = simplex2(0, 0);
  assert.ok(Number.isFinite(v), `simplex2(0,0) = ${v} no es finito`);
});

// --- fbm2 ---

test('fbm2 devuelve valores en rango [-1, 1]', () => {
  const noise = createNoise(42);
  for (let i = 0; i < 100; i++) {
    const x = (Math.random() - 0.5) * 50;
    const y = (Math.random() - 0.5) * 50;
    const v = fbm2(noise, x, y, { octaves: 4 });
    assert.ok(v >= -1 && v <= 1, `fbm2 valor ${v} fuera de rango`);
  }
});

test('fbm2 con más octavas produce señal distinta a una sola octava', () => {
  const noise = createNoise(42);
  let diffs = 0;
  const N = 50;
  const step = 0.37;

  for (let i = 0; i < N; i++) {
    const x = i * step;
    const v1 = fbm2(noise, x, 0, { octaves: 1 });
    const v4 = fbm2(noise, x, 0, { octaves: 6 });
    if (Math.abs(v1 - v4) > 0.001) diffs++;
  }

  // Con más octavas la señal debe diferir en la mayoría de puntos
  assert.ok(diffs > N * 0.5, `fbm2 con 6 octavas debe diferir de 1 octava en la mayoría de puntos (diffs=${diffs}/${N})`);
});

test('fbm2 es determinista', () => {
  const n1 = createNoise(55);
  const n2 = createNoise(55);
  const opts = { octaves: 4 };
  for (let i = 0; i < 30; i++) {
    assert.equal(
      fbm2(n1, i * 0.5, i * 0.3, opts),
      fbm2(n2, i * 0.5, i * 0.3, opts),
    );
  }
});
