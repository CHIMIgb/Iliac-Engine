/**
 * LevelSerializer.ts — Serialización del Level Editor
 *
 * Convierte el documento del editor (LevelDocument) <-> project.json schema v3
 * tal como lo consume el motor, y lo valida reutilizando engine/core/validate.js.
 */

import { validateProject } from '../../../engine/core/validate.js';
import { createLevelDocument } from './LevelDocument.js';
import type { LevelDocument, LevelProject, WorldData } from './LevelDocument.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/** Serializa el documento a project.json v3. Devuelve un objeto nuevo (sin mutar el doc). */
export function toProjectJson(doc: LevelDocument): LevelProject {
  return {
    meta: {
      name: doc.meta.name,
      schemaVersion: doc.meta.schemaVersion,
      renderMode: doc.meta.renderMode,
    },
    render: {
      fov: doc.render.fov,
      near: doc.render.near,
      far: doc.render.far,
      backgroundColor: doc.render.backgroundColor,
      ambientLight: { ...doc.render.ambientLight },
      directionalLight: {
        ...doc.render.directionalLight,
        position: [...doc.render.directionalLight.position],
      },
    },
    camera: {
      posX: doc.camera.posX,
      posY: doc.camera.posY,
      posZ: doc.camera.posZ,
      yaw: doc.camera.yaw,
      pitch: doc.camera.pitch,
    },
    world: {
      vertices: doc.world.vertices.map((v) => ({ ...v })),
      sectors: doc.world.sectors.map((s) => ({
        ...s,
        vertexIds: [...s.vertexIds],
        floorSlope: s.floorSlope ? { ...s.floorSlope } : undefined,
        ceilSlope: s.ceilSlope ? { ...s.ceilSlope } : undefined,
      })),
      walls: doc.world.walls.map((w) => ({ ...w })),
      ramps: doc.world.ramps.map((r) => ({ ...r, pos: { ...r.pos }, direction: { ...r.direction } })),
      sprites: doc.world.sprites.map((sp) => ({ ...sp, pos: { ...sp.pos } })),
      textures: { ...doc.world.textures },
    },
  };
}

/** Carga un LevelDocument desde un project.json v3 (o parcial). */
export function fromProjectJson(json: Partial<LevelProject>): LevelDocument {
  // ponytail: _seq se reinicia en 0 al cargar; basta mientras la plantilla no use
  // ids del formato v_N/w_N/sector_N. Si llegara a colisionar, derivar _seq del
  // máximo de ids existentes (mirar prefijos numéricos) antes de devolver.
  const world: Partial<WorldData> = json.world || {};
  return createLevelDocument({
    meta: json.meta as LevelProject['meta'],
    render: json.render as LevelProject['render'],
    camera: json.camera as LevelProject['camera'],
    world: {
      vertices: world.vertices,
      sectors: world.sectors,
      walls: world.walls,
      ramps: world.ramps,
      sprites: world.sprites,
      textures: world.textures,
    },
  });
}

/** Valida el documento como project.json v3 reutilizando la validación del motor. */
export function validate(doc: LevelDocument): ValidationResult {
  const result = validateProject(toProjectJson(doc) as any);
  return {
    valid: result.valid,
    errors: result.errors,
    warnings: result.warnings,
  };
}