/**
 * Serializer — convierte EditorState ⇄ project.json (portable para el motor).
 *
 * El Studio edita sobre EditorState; el motor consume project.json v3.
 * Este módulo es el puente: produce exactamente la forma que el motor valida
 * y consume (mismo esquema que demo/project.js).
 *
 * La validación de salida reutiliza `validateProject` del motor
 * (@engine/core/validate.js) para garantizar round-trip sin errores.
 */

import { validateProject } from '@engine/core/validate.js';
import { EditorState } from '../editor/EditorState';
import type { EditableTextures } from '../editor/types';

export interface ProjectJson {
  meta: EditorState['meta'];
  render: EditorState['render'];
  camera: EditorState['camera'];
  world: {
    vertices: EditorState['world']['vertices'];
    sectors: EditorState['world']['sectors'];
    walls: EditorState['world']['walls'];
    ramps: EditorState['world']['ramps'];
    sprites: EditorState['world']['sprites'];
    textures: EditorState['world']['textures'];
  };
}

export function toProjectJson(state: EditorState): ProjectJson {
  return {
    meta: { ...state.meta },
    render: { ...state.render },
    camera: { ...state.camera },
    world: {
      vertices: state.world.vertices.map((v) => ({ ...v })),
      sectors: state.world.sectors.map((s) => ({ ...s })),
      walls: state.world.walls.map((w) => ({
        id: w.id,
        a: w.a,
        b: w.b,
        sectorFront: w.sectorFront,
        sectorBack: w.sectorBack,
        tex: w.tex,
        portal: w.portal,
      })),
      ramps: state.world.ramps.map((r) => ({ ...r })),
      sprites: state.world.sprites.map((s) => ({ id: s.id, tex: s.tex, pos: { ...s.pos }, scale: s.scale, billboard: s.billboard })),
      textures: { ...state.world.textures },
    },
  };
}

/** Normaliza un project.json a EditorState (ignora campos desconocidos). */
export function fromProjectJson(json: Record<string, unknown> | ProjectJson): EditorState {
  const world = (json.world ?? {}) as Record<string, unknown>;
  const textures = (world.textures ?? {}) as EditableTextures;

  return new EditorState({
    meta: (json.meta ?? { name: 'Proyecto', schemaVersion: 3 }) as EditorState['meta'],
    render: (json.render ?? {}) as EditorState['render'],
    camera: (json.camera ?? { posX: 0, posY: 0, posZ: 0.6 }) as EditorState['camera'],
    world: {
      vertices: Array.isArray(world.vertices) ? (world.vertices as EditorState['world']['vertices']) : [],
      sectors: Array.isArray(world.sectors) ? (world.sectors as EditorState['world']['sectors']) : [],
      walls: Array.isArray(world.walls) ? (world.walls as EditorState['world']['walls']) : [],
      ramps: Array.isArray(world.ramps) ? (world.ramps as EditorState['world']['ramps']) : [],
      sprites: Array.isArray(world.sprites) ? (world.sprites as EditorState['world']['sprites']) : [],
      textures,
    },
  });
}

/**
 * Valida un project.json contra el schema del motor.
 * Devuelve la lista de errores (vacía si es válido).
 */
export function validateProjectJson(json: Record<string, unknown> | ProjectJson): string[] {
  try {
    const { errors } = validateProject(json);
    return errors;
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
}
