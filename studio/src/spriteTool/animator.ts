/**
 * spriteTool/animator.ts — lógica pura del animador (Fase B, Paso 3).
 *
 * Todo sin canvas y sin DOM (testeable en Node): la UI solo monta la lista de
 * frames recortados, define animaciones (plantilla idle/walk/attack/death o
 * libres) y pide aquí los objetos listos para guardar en el proyecto.
 *
 * Las salidas (`textures` + `spriteAnims`) cumplen el contrato del motor
 * (SPRITE_TOOL_PLAN §6) y se validan con `validateProject` real antes de
 * devolverse.
 */

import { validateProject } from '@engine/core/validate.js';
import { textureKeyFor, urlFor } from './frames';

/** FPS por defecto y rango clamps para las animaciones. */
export const DEFAULT_FPS = 8;
export const MIN_FPS = 1;
export const MAX_FPS = 60;

/** Nombres de la plantilla clásica de animaciones. */
export const TEMPLATE_ANIMS = ['idle', 'walk', 'attack', 'death'] as const;
export type TemplateAnimName = (typeof TEMPLATE_ANIMS)[number];

/** Definición de una animación lista para `world.spriteAnims`. */
export interface AnimDef {
  frames: string[];
  fps: number;
  loop: boolean;
}

/** Especificación en construcción (la UI la arma con índices de frame). */
export interface AnimSpec {
  name: string;
  /** Índices de la lista de frames recortados (en orden de reproducción). */
  frameIndices: number[];
  fps: number;
  loop: boolean;
}

/** Salida del guardado: texturas + animaciones prontas para el proyecto. */
export interface SpriteAnimsOutput {
  textures: Record<string, string>;
  spriteAnims: Record<string, AnimDef>;
  errors: string[];
}

/**
 * Reparte `nFrames` en la plantilla idle/walk/attack/death: cada animación se
 * queda con el número de frames proporcional (idle 25 %, walk 35 %, attack
 * 25 %, death 15 %) y con las sobras asignadas a walk. Índices contiguos en
 * el orden de la hoja. Cada animación termina con ≥1 frame (buildAnimDef
 * asegura ≥2 al construirse).
 */
export function defaultAnimTemplate(nFrames: number): AnimSpec[] {
  const total = Math.max(0, Math.floor(nFrames));
  const names = TEMPLATE_ANIMS;
  const sizes = [
    Math.round(total * 0.25),
    Math.round(total * 0.35),
    Math.round(total * 0.25),
    Math.round(total * 0.15),
  ];
  // Corrige redondeos para cubrir exactamente todos los frames.
  const used = sizes[0]! + sizes[1]! + sizes[2]! + sizes[3]!;
  sizes[1]! += total - used;

  const out: AnimSpec[] = [];
  let cursor = 0;
  for (let i = 0; i < names.length; i++) {
    const size = Math.max(1, sizes[i]!);
    const frameIndices: number[] = [];
    for (let k = 0; k < size && cursor < total; k++) frameIndices.push(cursor++);
    if (frameIndices.length === 0) frameIndices.push(total - 1 >= 0 ? total - 1 : 0);
    out.push({
      name: names[i]!,
      frameIndices,
      fps: DEFAULT_FPS,
      loop: names[i] === 'attack' || names[i] === 'death' ? false : true,
    });
  }
  return out;
}

/**
 * Normaliza una definición a un `AnimDef` válido para el motor:
 *  - frames con **al menos 2** (si se pasa 1 o 0, se duplica/rellena con el
 *    primer frame — el contrato del motor exige ≥2).
 *  - fps clamp a MIN_FPS..MAX_FPS (1–60).
 *  - loop booleano (por defecto true).
 */
export function buildAnimDef(frames: string[], fps = DEFAULT_FPS, loop = true): AnimDef {
  const first = frames[0] ?? '';
  const list = frames.length >= 2 ? frames.slice() : [first, first];
  return { frames: list, fps: clampFps(fps), loop: !!loop };
}

/** Clamp del fps a un valor utilizable por el motor (1–60). */
export function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) return DEFAULT_FPS;
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)));
}

/**
 * Reordena una lista de frames (por índice) sin mutar la original. Devuelve
 * una copia nueva — la hoja en memoria nunca se toca.
 */
export function reorderFrames<T>(frames: T[], from: number, to: number): T[] {
  const out = frames.slice();
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out;
  const [moved] = out.splice(from, 1);
  if (moved === undefined) return out;
  out.splice(to, 0, moved);
  return out;
}

/**
 * Quita el índice en `pos` sin mutar la original (7d). Si la lista quedaría
 * con menos de 2 frames, devuelve la copia sin cambios: el contrato del
 * motor exige ≥2 frames por animación.
 */
export function removeFrameIndices(frameIndices: number[], pos: number): number[] {
  if (pos < 0 || pos >= frameIndices.length) return frameIndices.slice();
  const out = frameIndices.slice();
  out.splice(pos, 1);
  if (out.length < 2) return frameIndices.slice();
  return out;
}

/**
 * Índices de frame (0..total-1) que aún no están en `frameIndices` (7d):
 * los frames de la hoja disponibles para añadir a la anim activa.
 */
export function availableFrames(frameIndices: number[], total: number): number[] {
  const inUse = new Set(frameIndices);
  const out: number[] = [];
  for (let i = 0; i < Math.max(0, total); i++) if (!inUse.has(i)) out.push(i);
  return out;
}

/**
 * Arma el par `{ textures, spriteAnims }` listo para guardar en el proyecto.
 *
 * - `assetId` es el nombre del asset del Paso 1 (`guard` → `guard_f0`…).
 * - `frameCount` son los frames recortados disponibles (para crear las
 *   texturas con `urlFor`, el contrato del middleware).
 * - `anims` son las animaciones (especificaciones con índices).
 *
 * ANTES de devolver, valida con `validateProject` REAL del motor: si las
 * texturas o las animaciones no cumplen el contrato (p.ej. un frame que no
 * existe), devuelve `errors` descriptivos en español y el usuario lo ve.
 */
export function buildSpriteAnims(
  assetId: string,
  frameCount: number,
  anims: AnimSpec[],
): SpriteAnimsOutput {
  const textures: Record<string, string> = {};
  for (let i = 0; i < Math.max(0, frameCount); i++) {
    textures[textureKeyFor(assetId, i)] = urlFor(assetId, i);
  }

  const spriteAnims: Record<string, AnimDef> = {};
  const errors: string[] = [];
  for (const spec of anims) {
    const frames = spec.frameIndices.map((i) => textureKeyFor(assetId, i));
    spriteAnims[spec.name] = buildAnimDef(frames, spec.fps, spec.loop);
  }

  // Validación contra el motor real: el proyecto mínimo debe pasar.
  const probe = {
    meta: { schemaVersion: 3 },
    camera: { posX: 0, posY: 0, posZ: 0.5 },
    world: {
      vertices: [],
      sectors: [],
      textures,
      spriteAnims,
    },
  };
  const result = validateProject(probe as never);
  for (const e of result.errors) errors.push(e);
  return { textures, spriteAnims, errors };
}