/**
 * render-signature.test.ts — regresión 2026-09-17: la decisión barato/caro del
 * reload del viewport comparaba `JSON.stringify(render)` a pelo, así que el
 * ORDEN de las claves contaba. Postgres (JSONB) devuelve las claves ordenadas
 * por longitud+alfabeto y el EditorState las escribe en orden de constructor:
 * los mismos valores parecían un cambio → reload caro en cada carga desde la API
 * (recrear el motor con el viejo vivo dejaba el viewport congelado).
 */
import { describe, it, expect } from 'vitest';
import { renderSignature } from '../src/viewport/renderSignature';

describe('renderSignature', () => {
  const local = { fov: 80, near: 0.1, far: 500, fog: { color: 1710638, density: 0.005 } };
  /** Mismos valores, claves reordenadas (como salen de Postgres JSONB). */
  const jsonb = { far: 500, fog: { density: 0.005, color: 1710638 }, fov: 80, near: 0.1 };

  it('ignora el orden de las claves (mismo contenido ⇒ misma firma)', () => {
    expect(renderSignature(local)).toBe(renderSignature(jsonb));
  });

  it('detecta cambios reales de valor', () => {
    expect(renderSignature(local)).not.toBe(renderSignature({ ...local, fov: 90 }));
    expect(renderSignature(local)).not.toBe(renderSignature({ ...local, fog: { color: 0, density: 0.005 } }));
  });

  it('trata render ausente y null por igual (y distinto de un render real)', () => {
    expect(renderSignature(undefined)).toBe(renderSignature(null));
    expect(renderSignature(undefined)).not.toBe(renderSignature(local));
  });
});
