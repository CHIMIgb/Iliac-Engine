/**
 * spriteTool/types.ts — tipos compartidos del Sprite Tool (F5).
 *
 * El Sprite Tool corta hojas de sprites en frames y arma animaciones. Toda la
 * lógica vive en módulos puros (sin DOM) que operan sobre `PixelImage`: una
 * imagen RGBA genérica (misma forma que `ImageData`, pero sin depender del
 * navegador para poder testearse en Node).
 */

/** Región rectangular en píxeles (del lienzo/imagen). w/h ≥ 1. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Imagen RGBA como bytes planos: data.length = width * height * 4. */
export interface PixelImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Animación guardada en el proyecto (`world.spriteAnims`). */
export interface EditableAnimSpec {
  frames: string[];
  fps?: number;
  loop?: boolean;
}

/**
 * Snapshot del proyecto leído por la Biblioteca (Fase D): texturas guardadas +
 * animaciones guardadas. Forma estructuralmente idéntica a
 * `world.textures`/`world.spriteAnims` del EditorState para no acoplar esta
 * herramienta con el editor.
 */
export interface SpriteLibrarySnapshot {
  textures: Record<string, string | number>;
  spriteAnims: Record<string, EditableAnimSpec>;
}