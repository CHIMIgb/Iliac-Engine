// El contrato project.json vive en contract/ (fuente única del schema v3).
// Este test verifica la ruta CANÓNICA (contract/project-schema.js) y que el
// shim del motor (engine/core/validate.js) delega en la MISMA función, sin
// duplicar lógica.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateProject as validateCanonical } from '../../contract/project-schema.js';
import { validateProject as validateViaEngine } from '../../engine/core/validate.js';

const base = {
  meta: { name: 'contrato' },
  world: {
    vertices: [{ id: 'v0', x: 0, y: 0 }, { id: 'v1', x: 10, y: 0 }, { id: 'v2', x: 10, y: 10 }, { id: 'v3', x: 0, y: 10 }],
    sectors: [{ id: 's0', vertexIds: ['v0', 'v1', 'v2', 'v3'] }],
    walls: [
      { id: 'w0', sectorFront: 's0', sectorBack: null, a: 'v0', b: 'v1' },
      { id: 'w1', sectorFront: 's0', sectorBack: null, a: 'v1', b: 'v2' },
      { id: 'w2', sectorFront: 's0', sectorBack: null, a: 'v2', b: 'v3' },
      { id: 'w3', sectorFront: 's0', sectorBack: null, a: 'v3', b: 'v0' },
    ],
  },
};

test('contract: la ruta canónica valida un proyecto correcto', () => {
  assert.equal(validateCanonical(base).errors.length, 0);
});

test('contract: la ruta canónica rechaza un proyecto inválido', () => {
  const invalid = { meta: {} }; // falta world
  assert.ok(validateCanonical(invalid).errors.length > 0);
});

test('contract: el motor NO duplica lógica — el shim es la misma función', () => {
  assert.equal(validateViaEngine, validateCanonical, 'engine/core/validate.js debe delegar en contract/project-schema.js');
});