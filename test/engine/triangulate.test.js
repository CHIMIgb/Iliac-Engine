import { test } from 'node:test';
import assert from 'node:assert/strict';
import { triangulate } from '../../engine/core/triangulate.js';

function verifyTriangulation(poly, tris) {
  const n = poly.length;
  assert.ok(tris.length === n - 2, `n=${n} vertices debe dar ${n-2} triángulos, obtuvo ${tris.length}`);
  for (const [a, b, c] of tris) {
    assert.ok(a >= 0 && a < n && b >= 0 && b < n && c >= 0 && c < n, 'índices en rango');
    assert.ok(a !== b && b !== c && c !== a, 'índices distintos');
  }
  // Opcional: verificar que ningún punto queda fuera (heurística simple - área cubierta)
  // Para test unitario, verificar número de triángulos es suficiente.
}

test('triangulate cuadrado convexo (4 vértices CCW)', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 6, y: 0 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ];
  const tris = triangulate(poly);
  verifyTriangulation(poly, tris);
});

test('triangulate cuadrado CW da mismo número de triángulos', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 0, y: 6 },
    { x: 6, y: 6 },
    { x: 6, y: 0 },
  ];
  const tris = triangulate(poly);
  verifyTriangulation(poly, tris);
});

test('triangulate pentágono convexo', () => {
  const poly = [
    { x: 0, y: 3 },
    { x: 3, y: 0 },
    { x: 6, y: 3 },
    { x: 4, y: 6 },
    { x: 1, y: 5 },
  ];
  const tris = triangulate(poly);
  verifyTriangulation(poly, tris);
});

test('triangulate sector cóncavo en forma de L', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 8, y: 4 },
    { x: 4, y: 4 },
    { x: 4, y: 8 },
    { x: 0, y: 8 },
  ];
  const tris = triangulate(poly);
  verifyTriangulation(poly, tris);
});

test('triangulate sector cóncavo con "diente" (agujero visible hacia afuera)', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 6, y: 10 },
    { x: 6, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 10 },
    { x: 0, y: 10 },
  ];
  const tris = triangulate(poly);
  verifyTriangulation(poly, tris);
});

test('triangulate devuelve vacío para < 3 vértices', () => {
  assert.deepEqual(triangulate([]), []);
  assert.deepEqual(triangulate([{ x: 0, y: 0 }]), []);
  assert.deepEqual(triangulate([{ x: 0, y: 0 }, { x: 1, y: 0 }]), []);
});

test('triangulate triangle ya triangulado', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 2, y: 4 },
  ];
  const tris = triangulate(poly);
  verifyTriangulation(poly, tris);
  assert.deepEqual(tris[0].sort(), [0, 1, 2].sort());
});