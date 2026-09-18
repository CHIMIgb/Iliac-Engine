/**
 * place.test.ts — lógica pura del «Colocar en el mundo ▾» (Fase E, E2).
 */

import { describe, it, expect } from 'vitest';
import { enabledPlaceAnims } from '../../src/spriteTool/place';
import type { SpriteLibrarySnapshot } from '../../src/spriteTool/types';

function snapshot(): SpriteLibrarySnapshot {
  return {
    textures: {
      guard_f0: '/assets/guard_f0.png',
      guard_f1: '/assets/guard_f1.png',
      potion: 0x00ff00, // color puro: no colocable
    },
    spriteAnims: {
      idle: { frames: ['guard_f0', 'guard_f1'], fps: 4, loop: true },
      potion_idle: { frames: ['potion'], fps: 2, loop: false },
      rota: { frames: ['no_existe'], fps: 4 },
    },
  };
}

describe('enabledPlaceAnims (E2)', () => {
  it('listo las anims con primer frame de textura real (string)', () => {
    const out = enabledPlaceAnims(snapshot());
    expect(out).toEqual([{ anim: 'idle', tex: 'guard_f0' }]);
  });

  it('tex de color (número) en el primer frame → la anim no se coloca', () => {
    const snap = snapshot();
    snap.spriteAnims.potion_idle = { frames: ['potion'], fps: 2 };
    const out = enabledPlaceAnims(snap);
    expect(out.map((e) => e.anim)).not.toContain('potion_idle');
  });

  it('frame inexistente en texturas → la anim no se coloca', () => {
    const out = enabledPlaceAnims(snapshot());
    expect(out.map((e) => e.anim)).not.toContain('rota');
  });

  it('snapshot nulo o vacío → lista vacía', () => {
    expect(enabledPlaceAnims(null)).toEqual([]);
    expect(enabledPlaceAnims({ textures: {}, spriteAnims: {} })).toEqual([]);
  });
});