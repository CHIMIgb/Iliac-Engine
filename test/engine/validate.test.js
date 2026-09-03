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

test('Engine3D lanza error claro con project inválido', async () => {
  const { Engine3D } = await import('../../engine/Engine3D.js');
  assert.throws(() => new Engine3D({ world: {} }), /project.json inválido/);
});
