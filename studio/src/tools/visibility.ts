/**
 * visibility.ts — visibilidad de sprites/entidades con la cámara del editor.
 *
 * Puro (sin DOM): proyecta la posición de cada sprite con la cámara Three.js
 * del renderer y decide si cae dentro del frustum visible actual. Lo usa el
 * Studio para limitar los selects de «asignar a entidad» a lo que el creador
 * está viendo en el viewport (Biblioteca D4 y Paso 3 del Sprite Tool).
 *
 * Coordenadas: el doc usa {x, y, z} con z = altura; Three.js mapea
 * (x, altura=y, profundidad=z). Aquí se traduce igual que Overlay2D/EditorViewport.
 */

import * as THREE from 'three';

const _v3 = new THREE.Vector3();

/**
 * Devuelve los ids de sprites visibles con la cámara dada.
 * @param sprites Lista de sprites del mundo (basta id + pos).
 * @param camera Cámara del renderer; si es null se devuelven todos (sin motor).
 * @param margin Margen NDC adicional (±0.15) para entidades casi en el borde.
 */
export function visibleSpriteIds(
  sprites: ReadonlyArray<{ id: string; pos: { x: number; y: number; z: number } }>,
  camera: THREE.Camera | null,
  margin = 0.15,
): Set<string> {
  if (!camera) return new Set(sprites.map((s) => s.id));
  const m = 1 + margin;
  const visible = new Set<string>();
  for (const sp of sprites) {
    _v3.set(sp.pos.x, sp.pos.z, sp.pos.y); // x, altura, profundidad
    const p = _v3.project(camera);
    // NDC: dentro de [-1,1] con margen lateral; z en [-1,1] excluye lo que
    // queda detrás de la cámara (se proyecta invertido en NDC).
    if (p.x >= -m && p.x <= m && p.y >= -m && p.y <= m && p.z >= -1 && p.z <= 1) {
      visible.add(sp.id);
    }
  }
  return visible;
}