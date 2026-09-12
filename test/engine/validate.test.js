import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProject } from '../../engine/core/validate.js';

function validProject(overrides = {}) {
  return {
    meta: { schemaVersion: 3 },
    camera: { posX: 1, posY: 1, posZ: 0.5 },
    world: {
      vertices: [
        { id: 'v0', x: 0, y: 0 },
        { id: 'v1', x: 4, y: 0 },
        { id: 'v2', x: 4, y: 4 },
        { id: 'v3', x: 0, y: 4 },
      ],
      sectors: [
        { id: 's0', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 0, ceilH: 3 },
      ],
      walls: [
        { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null },
      ],
      ...overrides,
    },
  };
}

test('validateProject acepta un proyecto válido', () => {
  const r = validateProject(validProject());
  assert.equal(r.valid, true);
  assert.equal(r.errors.length, 0);
});

test('validateProject rechaza world ausente', () => {
  const r = validateProject({ meta: {} });
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('world')));
});

test('validateProject rechaza vértice sin id', () => {
  const p = validProject();
  p.world.vertices.push({ x: 9, y: 9 });
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('id')));
});

test('validateProject rechaza sector que referencia vértice inexistente', () => {
  const p = validProject();
  p.world.sectors[0].vertexIds = ['v0', 'v1', 'v999'];
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('v999')));
});

test('validateProject rechaza pared que referencia sector inexistente', () => {
  const p = validProject();
  p.world.walls[0].sectorFront = 'nope';
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('nope')));
});

test('validateProject advierte pero no falla sin walls', () => {
  const p = validProject();
  delete p.world.walls;
  const r = validateProject(p);
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.includes('walls')));
});

test('validateProject acepta cielo realista F4.7 válido', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', hour: 12.5, dayLengthSec: 1200, shadows: true, sunTilt: 23.5 };
  const r = validateProject(p);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
  assert.equal(r.errors.length, 0);
});

test('validateProject acepta hora 24 (medianoche) y dayLengthSec 0 (manual)', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', hour: 24, dayLengthSec: 0 };
  const r = validateProject(p);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('validateProject acepta ajustes F4.7 en realista (sol/luna/estrellas/aurora)', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', sunIntensity: 0.85, moonIntensity: 0.35, stars: true, aurora: true, auroraIntensity: 1.4, auroraColor: '#ff4080' };
  const r = validateProject(p);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('validateProject rechaza auroraColor que no sea hex válido', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', auroraColor: 'verde' };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('auroraColor')));
});

test('validateProject rechaza ajustes F4.7 fuera de rango en realista', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', sunIntensity: 5, moonIntensity: 2, auroraIntensity: 9 };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('sunIntensity')));
  assert.ok(r.errors.some((e) => e.includes('moonIntensity')));
  assert.ok(r.errors.some((e) => e.includes('auroraIntensity')));
});

test('validateProject rechaza aurora no booleana', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', aurora: 'sí' };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('aurora')));
});

test('validateProject rechaza ajustes F4.7 en estilo clásico', () => {
  const p = validProject();
  p.world.sky = { set: 3, stars: false, aurora: true, auroraIntensity: 1, auroraColor: '#ff4080' };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('no usa')));
});

test('validateProject acepta cielo clásico SIN style (retrocompatibilidad)', () => {
  const p = validProject();
  p.world.sky = { set: 15, frame: 17 };
  const r = validateProject(p);
  assert.equal(r.valid, true, JSON.stringify(r.errors));
});

test('validateProject rechaza hour fuera de rango en realista', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', hour: 25 };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('hour')));
});

test('validateProject rechaza mezclar set/frame con estilo realista', () => {
  const p = validProject();
  p.world.sky = { style: 'realista', set: 3 };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('no usa set/frame')));
});

test('validateProject rechaza estilo desconocido', () => {
  const p = validProject();
  p.world.sky = { style: 'fantasia' };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('style')));
});

test('validateProject rechaza campos de realista en estilo clásico', () => {
  const p = validProject();
  p.world.sky = { set: 3, hour: 12 };
  const r = validateProject(p);
  assert.equal(r.valid, false);
  assert.ok(r.errors.some((e) => e.includes('no usa hour')));
});

test('Engine3D lanza error claro con project inválido', async () => {
  const { Engine3D } = await import('../../engine/Engine3D.js');
  assert.throws(() => new Engine3D({ world: {} }), /project.json inválido/);
});
