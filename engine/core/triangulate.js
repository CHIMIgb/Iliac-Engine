// Triangulación de polígonos por "ear clipping" (O(n²)). Funciona para
// polígonos cóncavos y convexos, e incluso con agujeros no soportados (YAGNI;
// el schema v3 no modela agujeros). Entrada: array de {x, y} en orden de borde.
// Salida: array de ternas [i, j, k] con los índices de los triángulos,
// preservando el winding del polígono de entrada.

function cross(o, a, b) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function pointInTriangle(p, a, b, c) {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  const hasNeg = d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9;
  const hasPos = d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9;
  return !(hasNeg && hasPos);
}

function signedArea(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s * 0.5;
}

function isEar(points, remaining, i0, i1, i2, orientationSign) {
  const a = points[i0];
  const b = points[i1];
  const c = points[i2];
  // Convexo respecto al winding del polígono.
  if (cross(a, b, c) * orientationSign <= 0) return false;
  // Ningún otro vértice restante cae dentro del oído.
  for (const i of remaining) {
    if (i === i0 || i === i1 || i === i2) continue;
    if (pointInTriangle(points[i], a, b, c)) return false;
  }
  return true;
}

export function triangulate(points) {
  const n = points.length;
  if (n < 3) return [];
  const tris = [];
  const remaining = points.map((_, i) => i);
  const orientationSign = Math.sign(signedArea(points)) || 1;

  let guard = 0;
  while (remaining.length > 3 && guard++ < n * n) {
    let clipped = false;
    for (let k = 0; k < remaining.length; k++) {
      const i0 = remaining[(k - 1 + remaining.length) % remaining.length];
      const i1 = remaining[k];
      const i2 = remaining[(k + 1) % remaining.length];
      if (isEar(points, remaining, i0, i1, i2, orientationSign)) {
        tris.push([i0, i1, i2]);
        remaining.splice(k, 1);
        clipped = true;
        break;
      }
    }
    if (!clipped) break; // Polígono degenerado; evitar bucle infinito.
  }

  if (remaining.length === 3) tris.push(remaining);
  return tris;
}
