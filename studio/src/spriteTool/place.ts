/**
 * place.ts — lógica pura del «Colocar en el mundo ▾» (Fase E, E2).
 *
 * Un sprite solo se puede colocar si su animación existe EN EL PROYECTO
 * (`world.spriteAnims`) y su primer frame apunta a una textura real (string).
 * Las anims locales del animador (Paso 3) aún no existen en `world.spriteAnims`
 * hasta pulsar «Guardar en el proyecto», y una textura de color (número) no
 * tiene imagen que mostrar en el motor → esas anims no son colocables.
 *
 * Aislada en un módulo puro (sin DOM) para poder testearla en Node; la UI la
 * consume en el Paso 3 y en la Biblioteca.
 */

import type { SpriteLibrarySnapshot } from './types';

/** Animación colocable: nombre + textura del primer frame (string). */
export interface EnabledPlaceAnim {
  anim: string;
  tex: string;
}

/** Anims guardadas del proyecto que se pueden colocar como sprite animado. */
export function enabledPlaceAnims(snapshot: SpriteLibrarySnapshot | null): EnabledPlaceAnim[] {
  if (!snapshot) return [];
  const out: EnabledPlaceAnim[] = [];
  for (const [anim, spec] of Object.entries(snapshot.spriteAnims)) {
    const tex = spec.frames[0];
    // Solo texturas string (imagen): el primer frame condiciona la tex del
    // sprite en `addSprite(tex, ...)`. Color puro (número) → no colocable.
    if (typeof tex === 'string' && typeof snapshot.textures[tex] === 'string') {
      out.push({ anim, tex });
    }
  }
  return out;
}