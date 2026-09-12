/**
 * daylight.test.js — lógica pura del ciclo día/noche (F4.7).
 * El cielo realista (SunSystem) depende de estas funciones: si la hora no
 * mueve el sol correctamente, el día/noche está roto en el motor.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sunDirection,
  moonDirection,
  sunElevation,
  paletteFor,
  advanceHour,
  hourLabel,
} from '../../engine/core/daylight.js';

test('sunDirection: el sol recorre este → cenit → oeste', () => {
  const amanecer = sunDirection(6);
  const mediodía = sunDirection(12);
  const atardecer = sunDirection(18);

  // Amanecer mira al este (z positivo... comprobamos solo simetría + y alto).
  assert.ok(amanecer.y < 0.01, `amanecer debe estar bajo, y=${amanecer.y}`);
  assert.ok(mediodía.y > 0.9, `mediodía debe ser casi cenit, y=${mediodía.y}`);
  assert.ok(atardecer.y < 0.01, `atardecer debe estar bajo, y=${atardecer.y}`);
  // Este y oeste son opuestos en el plano XZ.
  assert.ok(Math.abs(amanecer.x + atardecer.x) < 0.01, 'este/oeste opuestos en X');
});

test('sunDirection: la luna es el anti-sol (dirección exactamente opuesta)', () => {
  const h = 20;
  const s = sunDirection(h);
  const m = moonDirection(h);
  assert.ok(Math.abs(s.x + m.x) < 1e-9, 'anti-sol en X');
  assert.ok(Math.abs(s.y + m.y) < 1e-9, 'anti-sol en Y');
  assert.ok(Math.abs(s.z + m.z) < 1e-9, 'anti-sol en Z');
});

test('sunElevation: noche bajo el horizonte, día por encima', () => {
  assert.ok(sunElevation(0) < 0, 'medianoche: sol bajo');
  assert.ok(sunElevation(12) > 60, 'mediodía: sol alto');
  assert.ok(sunElevation(6) > -5 && sunElevation(6) < 5, 'amanecer: cerca del horizonte');
});

test('paletteFor: día más brillante que noche, niebla tiñe con la hora', () => {
  const dia = paletteFor(12);
  const noche = paletteFor(0);
  assert.ok(dia.sunIntensity > noche.sunIntensity, 'el sol de día ilumina más');
  assert.ok(dia.ambientIntensity > noche.ambientIntensity, 'ambiente de día más fuerte');
  assert.ok(noche.night > 0.5, 'de noche el factor noche domina');
  assert.ok(dia.sunColor !== noche.sunColor, 'el color del sol cambia con la hora');
  assert.notEqual(dia.fogColor, noche.fogColor, 'la niebla cambia de color');
});

test('advanceHour: avanza según dayLengthSec y envuelve pasada la medianoche', () => {
  // 10 min por día = 600 s → 60 s avanzan 2.4 h.
  assert.ok(Math.abs(advanceHour(12, 60, 600) - 14.4) < 1e-9);
  // Envuelve: 23.5 + 2.4 h → 1.9.
  assert.ok(Math.abs(advanceHour(23.5, 60, 600) - 1.9) < 1e-9);
  // dayLengthSec 0/faltante = reloj parado.
  assert.equal(advanceHour(12, 60, 0), 12);
});

test('hourLabel: formatea HH:MM redondeado', () => {
  assert.equal(hourLabel(12), '12:00');
  assert.equal(hourLabel(12.5), '12:30');
  assert.equal(hourLabel(23.75), '23:45');
});