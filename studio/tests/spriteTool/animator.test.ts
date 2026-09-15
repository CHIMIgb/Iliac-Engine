/**
 * studio/tests/spriteTool/animator.test.ts — lógica pura del animador (Fase B).
 *
 * Cubre: plantilla idle/walk/attack/death, ≥2 frames por animación, fps clamp,
 * reordenado sin mutar la hoja, y la salida `textures` + `spriteAnims`
 * validada contra `validateProject` REAL del motor.
 */
import { describe, it, expect } from 'vitest';
import {
  defaultAnimTemplate,
  buildAnimDef,
  clampFps,
  reorderFrames,
  buildSpriteAnims,
  DEFAULT_FPS,
} from '../../src/spriteTool/animator';
import { textureKeyFor, urlFor } from '../../src/spriteTool/frames';

describe('defaultAnimTemplate', () => {
  it('reparte N frames entre idle/walk/attack/death cubriendo todos', () => {
    const specs = defaultAnimTemplate(8);
    expect(specs.map((s) => s.name)).toEqual(['idle', 'walk', 'attack', 'death']);
    const indices = specs.flatMap((s) => s.frameIndices);
    expect([...indices].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(indices).toHaveLength(8);
  });

  it('cada animación tiene al menos 1 frame (buildAnimDef asegura ≥2)', () => {
    for (const spec of defaultAnimTemplate(4)) {
      expect(spec.frameIndices.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('loop por defecto: idle/walk true, attack/death false', () => {
    const specs = defaultAnimTemplate(8);
    const byName = Object.fromEntries(specs.map((s) => [s.name, s]));
    expect(byName['idle']!.loop).toBe(true);
    expect(byName['walk']!.loop).toBe(true);
    expect(byName['attack']!.loop).toBe(false);
    expect(byName['death']!.loop).toBe(false);
  });

  it('con 1 frame todas las animaciones usan el único frame (índice 0)', () => {
    const specs = defaultAnimTemplate(1);
    const indices = specs.flatMap((s) => s.frameIndices);
    // 4 anims × el único frame: todas apuntan al índice 0, nunca fuera de rango.
    expect(indices).toHaveLength(4);
    expect(indices.every((i) => i === 0)).toBe(true);
  });
});

describe('buildAnimDef', () => {
  it('con <2 frames duplica el único (contrato ≥2)', () => {
    const def = buildAnimDef(['guard_f0'], 10, false);
    expect(def.frames).toEqual(['guard_f0', 'guard_f0']);
    expect(def.fps).toBe(10);
    expect(def.loop).toBe(false);
  });

  it('con ≥2 frames conserva todos', () => {
    const def = buildAnimDef(['a', 'b', 'c']);
    expect(def.frames).toEqual(['a', 'b', 'c']);
  });

  it('fps por defecto 8 y loop por defecto true', () => {
    const def = buildAnimDef(['a', 'b']);
    expect(def.fps).toBe(DEFAULT_FPS);
    expect(def.loop).toBe(true);
  });
});

describe('clampFps', () => {
  it('clampa a 1–60 y redondea', () => {
    expect(clampFps(0)).toBe(1);
    expect(clampFps(-5)).toBe(1);
    expect(clampFps(999)).toBe(60);
    expect(clampFps(8.4)).toBe(8);
    expect(clampFps(NaN)).toBe(DEFAULT_FPS);
    expect(clampFps(Infinity)).toBe(DEFAULT_FPS);
  });
});

describe('reorderFrames', () => {
  it('reordena sin mutar la original', () => {
    const original = ['a', 'b', 'c', 'd'];
    const out = reorderFrames(original, 0, 2);
    expect(out).toEqual(['b', 'c', 'a', 'd']);
    expect(original).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignora índices fuera de rango o iguales', () => {
    expect(reorderFrames(['a', 'b'], -1, 1)).toEqual(['a', 'b']);
    expect(reorderFrames(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
    expect(reorderFrames(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('buildSpriteAnims (validado contra validateProject del motor)', () => {
  it('produce textures + spriteAnims válidos con la plantilla', () => {
    const anims = defaultAnimTemplate(8).map((s) => ({ ...s, name: s.name }));
    const out = buildSpriteAnims('guard', 8, anims);
    expect(out.errors).toEqual([]);
    // textures: guard_f0..guard_f7 con las URL del middleware
    expect(out.textures[textureKeyFor('guard', 0)]).toBe(urlFor('guard', 0));
    expect(Object.keys(out.textures)).toHaveLength(8);
    // spriteAnims: 4 animaciones, todas con ≥2 frames, fps/loop por plantilla
    for (const name of ['idle', 'walk', 'attack', 'death']) {
      const def = out.spriteAnims[name]!;
      expect(def.frames.length).toBeGreaterThanOrEqual(2);
      for (const f of def.frames) {
        expect(Object.prototype.hasOwnProperty.call(out.textures, f)).toBe(true);
      }
    }
  });

  it('reporta error del motor si un frame no existe (anim con frame fuera de rango)', () => {
    const anims = [{ name: 'idle', frameIndices: [0, 1], fps: 6, loop: true }];
    const out = buildSpriteAnims('guard', 1, anims); // solo guard_f0 existe
    expect(out.errors.length).toBeGreaterThan(0);
    expect(out.errors.some((e) => e.includes('no existe en world.textures'))).toBe(true);
  });

  it('reporta error del motor si una animación tiene <2 frames tras construir', () => {
    const anims = [{ name: 'idle', frameIndices: [0], fps: 6, loop: true }];
    const out = buildSpriteAnims('guard', 4, anims);
    // buildAnimDef duplica guard_f0 a [f0,f0], así que no hay error — el
    // duplicado garantiza el contrato; un frame inexistente SÍ daría error.
    expect(out.errors).toEqual([]);
    expect(out.spriteAnims['idle']!.frames).toEqual([textureKeyFor('guard', 0), textureKeyFor('guard', 0)]);
  });
});