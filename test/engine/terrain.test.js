import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTerrain, sectorSlopeAngle } from '../../engine/core/terrain.js';

// --- sectorSlopeAngle ---

test('sectorSlopeAngle devuelve 0 para sector plano', () => {
  const angle = sectorSlopeAngle([1, 1, 1, 1], 2);
  assert.equal(angle, 0);
});

test('sectorSlopeAngle devuelve ángulo positivo para sector inclinado', () => {
  // Pendiente en X: h0=0, h1=2 → dh/dx = 2/2 = 1 → atan(1) = π/4
  const angle = sectorSlopeAngle([0, 2, 2, 0], 2);
  assert.ok(angle > 0, 'ángulo debe ser positivo');
  assert.ok(Math.abs(angle - Math.PI / 4) < 0.01, `ángulo ${angle} ≈ π/4`);
});

test('sectorSlopeAngle devuelve null-safe para input inválido', () => {
  assert.equal(sectorSlopeAngle(null, 2), 0);
  assert.equal(sectorSlopeAngle([], 2), 0);
  assert.equal(sectorSlopeAngle([1], 2), 0);
});

// --- generateTerrain estructura ---

test('generateTerrain con grilla 3×3 produce 16 vértices', () => {
  const { vertices } = generateTerrain({ cols: 3, rows: 3 });
  assert.equal(vertices.length, 16, '(3+1)×(3+1) = 16 vértices');
});

test('generateTerrain con grilla 3×3 produce 9 sectores', () => {
  const { sectors } = generateTerrain({ cols: 3, rows: 3 });
  assert.equal(sectors.length, 9, '3×3 = 9 sectores');
});

test('cada sector tiene floorH como array de 4 elementos', () => {
  const { sectors } = generateTerrain({ cols: 2, rows: 2 });
  for (const s of sectors) {
    assert.ok(Array.isArray(s.floorH), `sector ${s.id} floorH debe ser array`);
    assert.equal(s.floorH.length, 4, `sector ${s.id} floorH debe tener 4 alturas`);
    for (const h of s.floorH) {
      assert.ok(h >= 0, `sector ${s.id} altura ${h} debe ser >= 0`);
    }
  }
});

test('cada sector tiene 4 vertexIds', () => {
  const { sectors } = generateTerrain({ cols: 2, rows: 2 });
  for (const s of sectors) {
    assert.equal(s.vertexIds.length, 4, `sector ${s.id} debe tener 4 vértices`);
  }
});

// --- Paredes ---

test('número correcto de paredes para grilla 3×3', () => {
  const { walls } = generateTerrain({ cols: 3, rows: 3 });
  // Horizontales: cols × (rows+1) = 3×4 = 12
  // Verticales: (cols+1) × rows = 4×3 = 12
  // Total = 24
  assert.equal(walls.length, 24, '3×4 + 4×3 = 24 paredes');
});

test('paredes de borde son sólidas (sectorBack = null)', () => {
  const { walls } = generateTerrain({ cols: 3, rows: 3 });
  const borderWalls = walls.filter((w) => w.sectorBack === null);
  // Perímetro: 2×(cols + rows) = 2×(3+3) = 12 paredes de borde
  assert.equal(borderWalls.length, 12, 'debe haber 12 paredes de borde');
  for (const w of borderWalls) {
    assert.ok(!w.portal, `pared de borde ${w.id} no debe ser portal`);
  }
});

test('paredes internas son portales', () => {
  const { walls } = generateTerrain({ cols: 3, rows: 3 });
  const portals = walls.filter((w) => w.portal === true);
  // Internas = total - borde = 24 - 12 = 12
  assert.equal(portals.length, 12, 'debe haber 12 portales internos');
  for (const p of portals) {
    assert.ok(p.sectorBack !== null, `portal ${p.id} debe tener sectorBack`);
  }
});

// --- Determinismo ---

test('generateTerrain es determinista (misma seed = mismo terreno)', () => {
  const t1 = generateTerrain({ cols: 4, rows: 4, seed: 77 });
  const t2 = generateTerrain({ cols: 4, rows: 4, seed: 77 });
  assert.deepEqual(t1.vertices, t2.vertices);
  assert.deepEqual(t1.sectors, t2.sectors);
  assert.deepEqual(t1.walls, t2.walls);
});

test('seeds distintas producen terrenos distintos', () => {
  const t1 = generateTerrain({ cols: 4, rows: 4, seed: 1 });
  const t2 = generateTerrain({ cols: 4, rows: 4, seed: 999 });
  // Al menos algunas alturas deben diferir
  let diffs = 0;
  for (let i = 0; i < t1.sectors.length; i++) {
    if (t1.sectors[i].floorH[0] !== t2.sectors[i].floorH[0]) diffs++;
  }
  assert.ok(diffs > 5, 'la mayoría de sectores deben tener alturas distintas');
});

// --- Texturas por pendiente ---

test('texturas varían según la pendiente del sector', () => {
  const { sectors } = generateTerrain({
    cols: 8, rows: 8,
    seed: 42,
    heightScale: 10,     // Terreno muy montañoso
    noiseScale: 0.15,
    textures: { flat: 'grass', slope: 'dirt', steep: 'rock' },
  });

  const texSet = new Set(sectors.map((s) => s.floorTex));
  // Con terreno variado, debería haber al menos 2 tipos de textura
  assert.ok(texSet.size >= 2, `debe haber variedad de texturas, encontradas: ${[...texSet].join(', ')}`);
});

// --- Vértices ---

test('vértices comparten posiciones en aristas de sectores adyacentes', () => {
  const { vertices, sectors } = generateTerrain({ cols: 2, rows: 2 });
  const vMap = new Map(vertices.map((v) => [v.id, v]));

  // Sectores adyacentes horizontalmente (s0_0 y s1_0) comparten v1_0 y v1_1
  const s00 = sectors[0]; // t_s0_0
  const s10 = sectors[1]; // t_s1_0
  // s00.vertexIds[1] debe ser v1_0 y s10.vertexIds[0] debe ser v1_0
  assert.equal(s00.vertexIds[1], s10.vertexIds[0],
    'sectores adyacentes comparten vértice en la arista');
});

// --- Alturas no negativas ---

test('todas las alturas generadas son >= 0', () => {
  const { sectors } = generateTerrain({ cols: 8, rows: 8, seed: 13 });
  for (const s of sectors) {
    for (const h of s.floorH) {
      assert.ok(h >= 0, `altura ${h} en sector ${s.id} debe ser >= 0`);
    }
  }
});
