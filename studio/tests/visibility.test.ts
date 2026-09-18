/**
 * visibility.test.ts — visibleSpriteIds: filtro por frustum de la cámara.
 *
 * Una cámara en perspectiva mirando hacia el origen; se comprueba qué
 * sprites caen dentro del viewport NDC (con margen) y cuáles no.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { visibleSpriteIds } from '../src/tools/visibility';

function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
  cam.position.set(10, 5, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
}

const sprite = (id: string, x: number, y: number, z: number) => ({ id, pos: { x, y, z } });

describe('visibleSpriteIds', () => {
  it('incluye sprites frente a la cámara y dentro del frustum', () => {
    const cam = makeCamera();
    const ids = visibleSpriteIds([sprite('a', 0, 0, 0), sprite('b', -2, 0, 1)], cam);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });

  it('excluye sprites detrás de la cámara', () => {
    const cam = makeCamera();
    // Detrás de la cámara (en -z relativo): la cámara está mirando a -z.
    const ids = visibleSpriteIds([sprite('back', 10, 0, 20)], cam);
    expect(ids.has('back')).toBe(false);
  });

  it('excluye sprites muy fuera del frustum lateral', () => {
    const cam = makeCamera();
    // Lejos en X → el margen (±0.15 NDC) no lo cubre, se proyecta fuera.
    const ids = visibleSpriteIds([sprite('far', 40, 0, 0)], cam);
    expect(ids.has('far')).toBe(false);
  });

  it('excluye sprites muy lejos (más allá del far plane)', () => {
    const cam = makeCamera();
    const ids = visibleSpriteIds([sprite('abyss', 0, 0, 500)], cam);
    expect(ids.has('abyss')).toBe(false);
  });

  it('sin cámara devuelve todos los ids (null-safe)', () => {
    const ids = visibleSpriteIds([sprite('a', 0, 0, 0), sprite('b', 999, 999, 999)], null);
    expect(ids.has('a')).toBe(true);
    expect(ids.has('b')).toBe(true);
  });

  it('el margen por defecto (±0.15) tolera entidades justo fuera de [-1,1]', () => {
    // Cámara ortográfica con NDC exacto [-1,1]: un punto en x=1.1 queda
    // fuera del rango estricto pero dentro del margen 1.15.
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    cam.position.set(0, 0, 10);
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    const ids = visibleSpriteIds([sprite('edge', 1.1, 0, 0)], cam);
    expect(ids.has('edge')).toBe(true);
    // Sin margen (0) el mismo punto queda fuera.
    const strict = visibleSpriteIds([sprite('edge', 1.1, 0, 0)], cam, 0);
    expect(strict.has('edge')).toBe(false);
  });
});