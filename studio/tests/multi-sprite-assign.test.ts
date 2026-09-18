/**
 * multi-sprite-assign.test.ts — reproducción del bug 2026-09-18:
 * "no puedo asignar diferentes sprites a diferentes entidades".
 *
 * Flujo del usuario:
 *  1. Coloca 3 magos (df_mage) y 1 aldeano (npc_villager) en la sala.
 *  2. Guarda la anim «mago_idle» (frames reales) y la asigna a cada mago.
 *  3. Guarda la anim «aldeano_idle» y la asigna al aldeano.
 *
 * Síntoma: solo una entidad muestra su sprite; el resto no (ni el aldeano).
 *
 * Hipótesis a demostrar: `assignEntityAnim` escribe `sprite.anim` incluso para
 * anims que NO están en `world.spriteAnims` (Paso 3, anim local sin guardar),
 * y `validateProjectJson` RECHAZA sprites con `anim` inexistente
 * (`contract/project-schema.js` l.204) → `scheduleReload` (main.ts l.692-696)
 * aborta sin llamar a `viewport.reload()` → el viewport se queda congelado y
 * los sprites asignados no aparecen.
 */
import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { placeEntityAt } from '../src/tools/tools';
import { getEntityDef } from '../src/entities/entityCatalog';
import { toProjectJson, validateProjectJson } from '../src/io/Serializer';

function makeRoom() {
  const state = new EditorState();
  const a = state.addVertex(0, 0);
  const b = state.addVertex(8, 0);
  const c = state.addVertex(8, 8);
  const d = state.addVertex(0, 8);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  return state;
}

function placeMagesAndVillager() {
  const state = makeRoom();
  const mago = getEntityDef('df_mage')!;
  const aldeano = getEntityDef('npc_villager')!;
  const ids = [
    placeEntityAt(state, 1, 1, mago),
    placeEntityAt(state, 3, 1, mago),
    placeEntityAt(state, 5, 1, mago),
    placeEntityAt(state, 2, 6, aldeano),
  ];
  return { state, ids };
}

describe('bug 2026-09-18: varias entidades con anims distintas (flujo real)', () => {
  it('asignar anims GUARDADAS a 4 entidades deja el proyecto VÁLIDO', () => {
    const { state, ids } = placeMagesAndVillager();
    state.setWorldTextures({
      mago_f0: 'data:a/mago_f0', mago_f1: 'data:a/mago_f1',
      aldeano_f0: 'data:a/aldeano_f0', aldeano_f1: 'data:a/aldeano_f1',
    });
    state.setSpriteAnims({
      mago_idle: { frames: ['mago_f0', 'mago_f1'], fps: 4, loop: true },
      aldeano_idle: { frames: ['aldeano_f0', 'aldeano_f1'], fps: 4, loop: true },
    });

    for (const id of ids.slice(0, 3)) expect(state.assignEntityAnim(id, 'mago_idle')).toBe(true);
    expect(state.assignEntityAnim(ids[3]!, 'aldeano_idle')).toBe(true);

    // Cada entidad adoptó su anim + el primer frame como tex.
    const sprites = state.world.sprites;
    expect(sprites.filter((s) => s.anim === 'mago_idle')).toHaveLength(3);
    expect(sprites[3]!.anim).toBe('aldeano_idle');
    expect(sprites[3]!.tex).toBe('aldeano_f0');

    // El proyecto completo debe pasar la validación (si no, el reload aborta).
    const raw = toProjectJson(state) as unknown as Record<string, unknown>;
    expect(validateProjectJson(raw)).toEqual([]);
  });

  it('FIX: anim NO guardada → assignEntityAnim devuelve false y el proyecto NO queda inválido', () => {
    const { state, ids } = placeMagesAndVillager();
    state.setWorldTextures({ mago_f0: 'data:a/mago_f0', mago_f1: 'data:a/mago_f1' });
    state.setSpriteAnims({ mago_idle: { frames: ['mago_f0', 'mago_f1'], fps: 4, loop: true } });

    // Flujo Paso 3: anim local del animador que aún NO se guardó al proyecto.
    expect(state.assignEntityAnim(ids[0]!, 'idle')).toBe(false); // «idle» no existe en spriteAnims
    expect(state.world.sprites.find((s) => s.id === ids[0]!)?.anim).toBeUndefined();

    // El proyecto completo sigue siendo válido (antes: error de validación →
    // scheduleReload abortaba y el viewport nunca recargaba).
    const raw = toProjectJson(state) as unknown as Record<string, unknown>;
    expect(validateProjectJson(raw)).toEqual([]);
  });

  it('el sprite sin textura real ni anim guardada NO es visible para el motor', () => {
    const { state, ids } = placeMagesAndVillager();
    // Sin texturas ni anims guardadas: todo sprite cae a defaultSpriteTex.
    const sp = state.world.sprites.find((s) => s.id === ids[0]!)!;
    // 'sprite_blue' NO existe en world.textures (catálogo sin assets cargados).
    expect(state.world.textures[sp.tex]).toBeUndefined();
  });
});