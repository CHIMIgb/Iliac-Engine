/**
 * fog.js — niebla atmosférica (distance fog) configurable desde project.json.
 *
 * Función pura: traduce la config `render.fog` del contrato de datos a un
 * THREE.FogExp2 listo para asignar a scene.fog. Sin config → null (sin niebla),
 * así un proyecto que no la declare se renderiza idéntico a antes.
 *
 * Formato: { color?: number, density?: number } — el color vacío hereda el
 * backgroundColor del render (fondo = color de niebla, fundido perfecto).
 */

import * as THREE from 'three';

const DEFAULT_DENSITY = 0.005;

export function createFog(fogConfig, bgColor = 0x202020) {
  if (!fogConfig || typeof fogConfig !== 'object') return null;
  const color = fogConfig.color ?? bgColor;
  const density = typeof fogConfig.density === 'number' ? fogConfig.density : DEFAULT_DENSITY;
  return new THREE.FogExp2(color, density);
}