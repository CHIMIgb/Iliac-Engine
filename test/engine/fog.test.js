/**
 * Test de engine/three/fog.js — niebla atmosférica configurable.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFog } from '../../engine/three/fog.js';

test('sin config devuelve null (proyecto sin niebla → render idéntico)', () => {
  assert.equal(createFog(undefined, 0x202020), null);
  assert.equal(createFog(null, 0x202020), null);
  assert.equal(createFog('mal', 0x202020), null);
});

test('config válida crea FogExp2 con color y densidad', () => {
  const fog = createFog({ color: 0x1a1a2e, density: 0.006 }, 0x202020);
  assert.ok(fog instanceof THREE.FogExp2);
  assert.equal(fog.color.getHex(), 0x1a1a2e);
  assert.equal(fog.density, 0.006);
});

test('color vacío hereda el backgroundColor del render', () => {
  const fog = createFog({ density: 0.004 }, 0x123456);
  assert.equal(fog.color.getHex(), 0x123456);
});

test('sin densidad usa el valor por defecto', () => {
  const fog = createFog({ color: 0xffffff }, 0x202020);
  assert.equal(fog.density, 0.005);
});