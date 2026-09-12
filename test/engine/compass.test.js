/**
 * compass.test.js — rotación de la brújula (F4.7).
 *
 * La brújula es un overlay HUD del motor (engine/three/CompassOverlay.js): la
 * rosa rota con el yaw del jugador y su norte (-Z de Three) coincide con el
 * polo de la aurora boreal. Solo se testea la fórmula pura (compassRotation);
 * el dibujo canvas (DOM) no se puede ejecutar en Node.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { compassRotation } from '../../engine/three/CompassOverlay.js';

// Igualdad angular: −π y +π son la misma orientación (la N apunta abajo).
function angleEq(a, b, eps = 1e-9) {
  const d = ((a - b + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  return Math.abs(d) < eps;
}

// El yaw 0 mira a +X (este), -π/2 mira a -Z (norte).
test('compassRotation: mirando al norte (yaw -π/2) la N queda arriba (0 rad)', () => {
  assert.ok(angleEq(compassRotation(-Math.PI / 2), 0));
});

test('compassRotation: mirando al este (yaw 0) la N queda a la izquierda (-π/2)', () => {
  assert.ok(angleEq(compassRotation(0), -Math.PI / 2));
});

test('compassRotation: mirando al sur (yaw +π/2) la N queda abajo (π)', () => {
  assert.ok(angleEq(compassRotation(Math.PI / 2), Math.PI));
});

test('compassRotation: mirando al oeste (yaw π) la N queda a la derecha (+π/2)', () => {
  assert.ok(angleEq(compassRotation(Math.PI), Math.PI / 2));
});