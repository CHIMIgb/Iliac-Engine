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