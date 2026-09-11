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
  /**
   * Registro del piso de los sectores con alturas por vértice (terrain grid):
   * sectorId → { groupKey, start, count } dentro del buffer mergeado.
   * Permite parchear las alturas en el sitio (solo los y afectados +
   * normals) sin reconstruir el mundo entero (el cuello del pincel en 32 m).
   */
  static _floorSlots = new Map();
  /** groupKey (`tex:side`) → Mesh mergeado, para localizar el buffer a parchear. */
  static _groupMeshes = new Map();

  static build(scene, project, textures) {
    WorldMesh.clear(scene);

    const world = project.world;
    if (!world.vertices || !world.sectors) return;
    WorldMesh.buildSectorWorld(scene, world, textures);
  }

  static clear(scene) {
    WorldMesh._floorSlots.clear();
    WorldMesh._groupMeshes.clear();
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const child = scene.children[i];
      if (child.userData?.isSky) continue; // el cielo lo gestiona SkySystem
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

  /**
   * Vía rápida de edición en vivo: si SOLO cambiaron alturas de piso
   * (`floorH` array) de sectores con slot registrado, parchea los `y` del
   * buffer compartido y recalcula normales. Devuelve true si se aplicó
   * (no hace falta rebuild) o false si el cambio exige reconstruir.
   */
  static applyHeightsIfOnlyChange(scene, oldWorld, newWorld) {
    if (!WorldMesh._floorSlots.size) return false;
    const dirty = [];

    // 1) Mismo set de sectores, en orden, con los mismos vértices.
    if (!oldWorld || oldWorld.sectors.length !== newWorld.sectors.length) return false;
    for (let i = 0; i < newWorld.sectors.length; i++) {
      const a = oldWorld.sectors[i];
      const b = newWorld.sectors[i];
      if (!a || a.id !== b.id) return false;
      if (a.vertexIds.length !== b.vertexIds.length) return false;
      for (let k = 0; k < b.vertexIds.length; k++) if (a.vertexIds[k] !== b.vertexIds[k]) return false;
    }

    // 2) Posiciones XY de los vértices intactas (si un vértice se movió en XZ,
    //    hay que reconstruir: el slot solo parchea alturas).
    const oldVerts = new Map(oldWorld.vertices.map((v) => [v.id, v]));
    if (oldVerts.size !== newWorld.vertices.length) return false;
    for (const v of newWorld.vertices) {
      const ov = oldVerts.get(v.id);
      if (!ov || ov.x !== v.x || ov.y !== v.y) return false;
    }

    // 3) Sectores con floorH distinto.
    for (let i = 0; i < newWorld.sectors.length; i++) {
      const a = oldWorld.sectors[i];
      const b = newWorld.sectors[i];
      if (!Array.isArray(b.floorH)) {
        if (a.floorH !== b.floorH) return false; // scalar cambiado: rebuild (paredes, etc.)
        continue;
      }
      let changed = !Array.isArray(a.floorH) || a.floorH.length !== b.floorH.length;
      if (!changed) {
        for (let k = 0; k < b.floorH.length; k++) if (a.floorH[k] !== b.floorH[k]) { changed = true; break; }
      }
      if (!changed) continue;
      if (a.vertexIds.some((vid) => (newWorld.walls || []).some((w) => w.sectorFront === b.id || w.sectorBack === b.id))) return false;
      dirty.push(b.id);
    }
    if (dirty.length === 0) return true; // sin cambios materiales visibles

    // 4) Parchear los slots en el buffer mergeado.
    const byId = new Map(newWorld.sectors.map((s) => [s.id, s]));
    const meshesDirty = new Set();
    for (const id of dirty) {
      const slot = WorldMesh._floorSlots.get(id);
      const mesh = slot && WorldMesh._groupMeshes.get(slot.groupKey);
      const sector = byId.get(id);
      if (!slot || !mesh || !sector || slot.count !== sector.floorH.length) return false;
      const attr = mesh.geometry.attributes.position;
      for (let k = 0; k < slot.count; k++) attr.setY(slot.start + k, sector.floorH[k] ?? 0);
      meshesDirty.add(mesh);
    }
    for (const mesh of meshesDirty) {
      mesh.geometry.computeVertexNormals(); // recrea + marca normal.needsUpdate
      mesh.geometry.attributes.position.needsUpdate = true;
    }
    return true;
  }

  static buildSectorWorld(scene, world, textures) {
    const { wallsBySector, vertexMap } = buildSectorIndex(world);

    // Agrupar geometrías por (textura, side) para mergear y reducir draw calls.
    const groups = new Map();
    // key → arranque del group; cada sector suma su cuenta al final de la lista.
    const groupVertCount = new Map();

    function addToGroup(tex, fallbackColor, side, geo, slotSectorId) {
      if (!geo) return;
      const key = `${tex}:${side}`;
      let group = groups.get(key);
      if (!group) {
        group = { tex, fallbackColor, side, geometries: [] };
        groups.set(key, group);
        groupVertCount.set(key, 0);
      }
      // Sectores de terreno (piso con alturas por vértice): anotar su hueco en
      // el buffer mergeado para poder parchear alturas sin reconstruir.
      if (slotSectorId) {
        WorldMesh._floorSlots.set(slotSectorId, {
          groupKey: key,
          start: groupVertCount.get(key),
          count: geo.attributes.position.count,
        });
      }
      groupVertCount.set(key, groupVertCount.get(key) + geo.attributes.position.count);
      group.geometries.push(geo);
    }

    for (const sector of world.sectors) {
      // Repetición de texturas para este sector
      const floorRepeat = getTextureRepeat(world, sector.floorTex);
      const ceilRepeat = getTextureRepeat(world, sector.ceilTex);
      const wallRepeat = getTextureRepeat(world, sector.wallTex);

      const floorGeo = createSectorFloorGeometry(world, sector, vertexMap, floorRepeat);
      addToGroup(
        sector.floorTex,
        0x555555,
        THREE.DoubleSide,
        floorGeo,
        Array.isArray(sector.floorH) ? sector.id : undefined,
      );
      addToGroup(
        sector.ceilTex,
        0x888888,
        THREE.FrontSide, // techo mira hacia abajo: al mirar hacia arriba se ve su backface y se cuela
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
    for (const [key, { tex, fallbackColor, side, geometries }] of groups) {
      const merged = mergeGeometries(geometries);
      if (!merged) continue;
      const mat = makeMaterial(textures, tex, fallbackColor, side);
      const mesh = new THREE.Mesh(merged, mat);
      WorldMesh._groupMeshes.set(key, mesh);
      scene.add(mesh);
    }

    buildStairsMeshes(scene, world, textures);
    buildSprites(scene, world, textures);
  }
}