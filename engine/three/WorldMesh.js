import * as THREE from 'three';
import { makeMaterial } from './textures.js';
import {
  createSectorFloorGeometry,
  createSectorCeilingGeometry,
  createWallGeometry,
} from './SectorGeometry.js';
import { mergeGeometries } from './GeometryMerge.js';
import { buildStairsMeshes } from './StairsMesh.js';
import { buildSprites } from './SpriteSystem.js';
import { buildSectorIndex } from '../core/sector.js';

function getTextureRepeat(world, texId) {
  if (!texId || !world.textures) return { x: 1, y: 1 };
  const def = world.textures[texId];
  if (!def) return { x: 1, y: 1 };
  if (typeof def === 'object' && def !== null && def.repeat !== undefined) {
    const r = def.repeat;
    if (typeof r === 'number') return { x: r, y: r };
    if (Array.isArray(r)) return { x: r[0] ?? 1, y: r[1] ?? 1 };
    if (typeof r === 'object') return { x: r.x ?? r.u ?? 1, y: r.y ?? r.v ?? 1 };
  }
  return { x: 1, y: 1 };
}

export class WorldMesh {
  static build(scene, project, textures) {
    WorldMesh.clear(scene);

    const world = project.world;
    if (!world.vertices || !world.sectors) return;
    WorldMesh.buildSectorWorld(scene, world, textures);
  }

  static clear(scene) {
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const child = scene.children[i];
      if (child.isMesh || child.isSprite) {
        if (child.geometry) child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
        scene.remove(child);
      }
    }
  }

  static buildSectorWorld(scene, world, textures) {
    const { wallsBySector, vertexMap } = buildSectorIndex(world);

    // Agrupar geometrías por (textura, side) para mergear y reducir draw calls.
    const groups = new Map();

    function addToGroup(tex, fallbackColor, side, geo) {
      if (!geo) return;
      const key = `${tex}:${side}`;
      let group = groups.get(key);
      if (!group) {
        group = { tex, fallbackColor, side, geometries: [] };
        groups.set(key, group);
      }
      group.geometries.push(geo);
    }

    for (const sector of world.sectors) {
      // Repetición de texturas para este sector
      const floorRepeat = getTextureRepeat(world, sector.floorTex);
      const ceilRepeat = getTextureRepeat(world, sector.ceilTex);
      const wallRepeat = getTextureRepeat(world, sector.wallTex);

      addToGroup(
        sector.floorTex,
        0x555555,
        THREE.DoubleSide,
        createSectorFloorGeometry(world, sector, vertexMap, floorRepeat)
      );
      addToGroup(
        sector.ceilTex,
        0x888888,
        THREE.DoubleSide,
        createSectorCeilingGeometry(world, sector, vertexMap, ceilRepeat)
      );

      // Mapa vértice del sector -> índice para lookups O(1) en paredes.
      const vertexIndexMap = new Map();
      for (let i = 0; i < sector.vertexIds.length; i++) {
        vertexIndexMap.set(sector.vertexIds[i], i);
      }

      const walls = wallsBySector.get(sector.id) || [];
      for (const wall of walls) {
        if (wall.sectorBack && wall.portal) continue;
        // Textura de la pared: prioridad wall.tex > sector.wallTex
        const wallTex = wall.tex || sector.wallTex;
        const wallRepeat = getTextureRepeat(world, wallTex);
        const wallGeo = createWallGeometry(wall, world, sector, vertexMap, vertexIndexMap, wallRepeat);
        addToGroup(wallTex || sector.wallTex, 0xcc0000, THREE.FrontSide, wallGeo);
      }
    }

    // Un mesh por material/textura.
    for (const { tex, fallbackColor, side, geometries } of groups.values()) {
      const merged = mergeGeometries(geometries);
      if (!merged) continue;
      const mat = makeMaterial(textures, tex, fallbackColor, side);
      scene.add(new THREE.Mesh(merged, mat));
    }

    buildStairsMeshes(scene, world, textures);
    buildSprites(scene, world, textures);
  }
}