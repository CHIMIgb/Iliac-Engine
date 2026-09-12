/**
 * compass.test.js — rumbo de la brújula (F4.7).
 *
 * La brújula es un overlay DOM del motor (engine/three/CompassOverlay.js): la
 * cinta de rumbo horizontal se desliza con headingDeg(yaw). El norte del mundo
 * (-Z de Three) coincide con el polo de la aurora boreal. Solo se testea la
 * función pura (headingDeg); el glue DOM/CSS se valida en navegador.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { headingDeg } from '../../engine/three/CompassOverlay.js';

const DEG = Math.PI / 180;

// El yaw 0 mira a +X (este), -π/2 mira a -Z (norte).
test('headingDeg: los 4 rumbos cardinales', () => {
  assert.equal(headingDeg(-90 * DEG), 0, 'norte (yaw -π/2) → 0°');
  assert.equal(headingDeg(0), 90, 'este (yaw 0) → 90°');
  assert.equal(headingDeg(90 * DEG), 180, 'sur (yaw +π/2) → 180°');
  assert.equal(headingDeg(180 * DEG), 270, 'oeste (yaw π) → 270°');
});

test('headingDeg: envuelve a 0–360 y tolera yaw negativos grandes', () => {
  assert.equal(headingDeg(270 * DEG), 0, 'norte otra vez a los 270°');
  assert.equal(headingDeg(360 * DEG), 90, 'una vuelta completa → este 90°');
  assert.equal(headingDeg(-450 * DEG), 0, 'yaw muy negativo envuelve (N)');
  const h = headingDeg(27 * DEG);
  assert.ok(h > 90 && h < 180, 'rumbo intermedio crece en el sentido correcto');
});