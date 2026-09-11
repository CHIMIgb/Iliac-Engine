/**
 * sample-project.ts — Proyecto inicial del Studio.
 *
 * Escenario de demostración para el playtest: terreno de 100×100 m (celdas de
 * 2 m → 50×50 = 2.500 sectores) con paisaje determinista por capas:
 *  - MONTAÑA CENTRAL: pico cónico de ~50 m en (50, 50) con flancos rugosos.
 *  - RÍO: meandro sinusoidal que cruza el mapa de oeste a este por la franja
 *    sur (~z 18), cauce rebajado a 0,25 m (atriesa el pie sur de la montaña).
 *  - RESTO: terreno medio irregular (colinas FBM de 0–5 m) para realismo.
 * SIN texturas por defecto: el suelo usa el gris de fallback del motor
 * (0x555555). El color lo elige el usuario pintando texturas en el editor.
 */
import { EditorState } from './editor/EditorState';
import { placeTerrainAt } from './tools/tools';
import { toProjectJson } from './io/Serializer';
import { createNoise, fbm2 } from '@engine/core/noise.js';

const SIZE = 100;      // lado del mapa en metros
const CELL = 2;        // tamaño de celda (2 m → 50×50 sectores, carga instantánea)
const SEED = 1337;
const WATER_LEVEL = 0.25; // lecho plano del río

/** Centro y radio de la montaña principal. */
export const MOUNTAIN = { x: 50, z: 50, radius: 38, height: 50 };

// ── Forma del terreno (funciones puras de coordenadas de mundo) ──

const smooth = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Cobertura del cauce [0..1]: 1 en el eje del río, 0 fuera de la ribera. */
function riverMask(x: number, z: number, noise2: ReturnType<typeof createNoise>): number {
  const zc = 18 + 8 * Math.sin(x * 0.07) + 5 * fbm2(noise2, x * 0.03, 3.7, { octaves: 2, lacunarity: 2, gain: 0.5 });
  const d = Math.abs(z - zc);
  return 1 - smooth((d - 4) / 10); // <=4 m cauce, >=14 m ribera terminada
}

/** Altura del terreno (metros) en (x, z). */
export function landscapeHeight(
  x: number,
  z: number,
  noise: ReturnType<typeof createNoise>,
  noise2: ReturnType<typeof createNoise>,
): number {
  // Terreno medio irregular: colinas suaves de 0–5 m (dos octavas de FBM)
  let h =
    1.8 +
    2.4 * (0.5 + 0.5 * fbm2(noise, x * 0.035, z * 0.035, { octaves: 3, lacunarity: 2, gain: 0.5 })) +
    0.9 * fbm2(noise, x * 0.09, z * 0.09, { octaves: 2, lacunarity: 2, gain: 0.5 });

  // Montaña central: perfil cónico con caída suave y rugosidad en los flancos
  const d = Math.hypot(x - MOUNTAIN.x, z - MOUNTAIN.z);
  const rim = 1 - smooth(d / MOUNTAIN.radius);
  if (rim > 0) {
    const wrinkles = 1 + 0.35 * fbm2(noise2, x * 0.06, z * 0.06, { octaves: 3, lacunarity: 2, gain: 0.5 });
    h += MOUNTAIN.height * Math.pow(rim, 1.6) * wrinkles;
  }

  // Río: rebajar hacia el lecho, mezclado con la máscara
  const river = riverMask(x, z, noise2);
  if (river > 0) h = h + (WATER_LEVEL - h) * river;

  return Math.round(Math.max(0, h) * 100) / 100;
}

function buildDefaultDoc(): EditorState {
  const doc = new EditorState();
  doc.camera = { posX: 50, posY: 2, posZ: 4, yaw: Math.PI / 2, pitch: 0 }; // borde sur, mirando de frente a la montaña
  placeTerrainAt(doc, 0, 0, SIZE, 'grass', CELL, 200); // techo 200 m: la cima (50 m) no se clava

  const noise = createNoise(SEED);
  const noise2 = createNoise(SEED + 1);
  const heights = new Map<string, number>();
  const pos = new Map<string, { x: number; z: number }>();
  for (const v of doc.world.vertices) {
    heights.set(v.id, landscapeHeight(v.x, v.y, noise, noise2));
    pos.set(v.id, { x: v.x, z: v.y });
  }

  // Celdas de agua (río): aplanar al lecho actuando sobre los VÉRTICES
  // compartidos → superficie plana sin abrir grietas con las celdas vecinas.
  for (const s of doc.world.sectors) {
    const hs = s.vertexIds.map((id) => heights.get(id) ?? 0);
    const cx = s.vertexIds.reduce((a, id) => a + pos.get(id)!.x, 0) / 4;
    const cz = s.vertexIds.reduce((a, id) => a + pos.get(id)!.z, 0) / 4;
    if (riverMask(cx, cz, noise2) > 0.85 && (hs[0]! + hs[1]! + hs[2]! + hs[3]!) / 4 < 0.6) {
      for (const id of s.vertexIds) heights.set(id, WATER_LEVEL);
    }
  }

  for (const s of doc.world.sectors) {
    // Mutación directa: setFloorHeight buscaría el sector en O(n) por celda
    // (O(n²) total) y aquí conocemos el orden de construcción.
    s.floorH = s.vertexIds.map((id) => heights.get(id) ?? 0);
  }
  return doc;
}

export const sampleProject = toProjectJson(buildDefaultDoc());
export { buildDefaultDoc };
