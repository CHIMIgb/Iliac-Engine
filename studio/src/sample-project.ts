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
 *
 * Fase D (Biblioteca): aún no hay backend ni assets reales, así que el
 * proyecto inicial trae SPRITES MOCK (dataURLs SVG de color sólido) +
 * animaciones de ejemplo. Así la Biblioteca puede verse poblada y validarse;
 * el usuario puede borrarlos cargando su propio material.
 */
import { EditorState } from './editor/EditorState';
import { placeTerrainAt, floorHeightAtPoint } from './tools/tools';
import { toProjectJson } from './io/Serializer';
import { createNoise, fbm2 } from '@engine/core/noise.js';
import type { EditableAudioDef, EditableMusicRef } from './editor/types';

// ── Sprites mock (Fase D): SVG dataURL de color sólido, sin assets ──
const MOCK_FRAMES: Record<string, string[]> = {
  guard: ['#e05b5b', '#c94f46', '#b0433b', '#9a3c33'], // guardia rojo
  wolf: ['#7a8ba6', '#6b7c97', '#5d6e88', '#526078'], // lobo azul-pizarra
  potion: ['#8be08b', '#6fd47f', '#58c16e', '#44ac5d'], // poción verde
};

function mockTextureDataUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="${color}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Puebla world.textures + world.spriteAnims con el set mock de la Fase D.
 *  Devuelve las claves de textura creadas. */
function installMockSprites(doc: EditorState): string[] {
  const textures: Record<string, string> = {};
  const anims: Record<string, { frames: string[]; fps: number; loop: boolean }> = {};
  const keys: string[] = [];
  for (const [name, colors] of Object.entries(MOCK_FRAMES)) {
    const frames = colors.map((color, i) => `mock_${name}_f${i}`);
    frames.forEach((key, i) => {
      textures[key] = mockTextureDataUrl(colors[i]!);
      keys.push(key);
    });
    anims[`${name}_idle`] = { frames, fps: 4, loop: true };
  }
  doc.setWorldTextures(textures);
  doc.setSpriteAnims(anims);
  return keys;
}

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

  // ── Audio F4.5: SIN audio precargado (decisión del usuario 2026-09-12): la
  // herramienta de Audio (tecla 9) añade ambientes bajo demanda. El motor se
  // comporta como no-op si audio[] está vacío.
  doc.audio = [];
  doc.music = null;
  // Fase D: sprites mock para que la Biblioteca del Sprite Tool se vea poblada.
  // Guardián en la ladera, apoyado en el terreno (sprite, sin bucle de audio).
  installMockSprites(doc);
  const gz = floorHeightAtPoint(doc.world, 62, 60);
  doc.addSprite('mock_guard_f0', 62, 60, gz, 'npc_guardian', {
    entityType: 'npc', entityName: 'Guardián', collisionType: 'npc',
  });
  // El guardián usa la animación mock de guardia (Fase D).
  doc.assignSpriteAnim('npc_guardian', 'guard_idle');

  return doc;
}

export const sampleProject = toProjectJson(buildDefaultDoc());
export { buildDefaultDoc };
