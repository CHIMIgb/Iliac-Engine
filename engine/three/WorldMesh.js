import * as THREE from 'three';
import { makeMaterial } from './textures.js';
import {
  createSectorFloorGeometry,
  createSectorCeilingGeometry,
  createWallGeometry,
} from './SectorGeometry.js';
import { buildStairsMeshes } from './StairsMesh.js';
import { buildSprites } from './SpriteSystem.js';
import { buildSectorIndex } from '../core/sector.js';

export class WorldMesh {
  static build(scene, project, textures) {
    WorldMesh.clear(scene);

    const world = project.world;
    if (world.vertices && world.sectors) {
      WorldMesh.buildSectorWorld(scene, world, textures);
    } else {
      WorldMesh.buildGridWorld(scene, world, textures);
    }
  }

  static clear(scene) {
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const child = scene.children[i];
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
        scene.remove(child);
      }
    }
  }

  // ---------- Schema v3: sectores poligonales ----------

  static buildSectorWorld(scene, world, textures) {
    const { wallsBySector } = buildSectorIndex(world);

    for (const sector of world.sectors) {
      const floorGeo = createSectorFloorGeometry(world, sector);
      const ceilGeo = createSectorCeilingGeometry(world, sector);

      const floorMesh = new THREE.Mesh(
        floorGeo,
        makeMaterial(textures, sector.floorTex, 0x555555, THREE.DoubleSide),
      );
      const ceilMesh = new THREE.Mesh(
        ceilGeo,
        makeMaterial(textures, sector.ceilTex, 0x888888, THREE.DoubleSide),
      );

      scene.add(floorMesh);
      scene.add(ceilMesh);

      const walls = wallsBySector.get(sector.id) || [];
      for (const wall of walls) {
        if (wall.sectorBack && wall.portal) continue;
        const wallGeo = createWallGeometry(wall, world, sector);
        if (!wallGeo) continue;
        const mat = makeMaterial(textures, wall.tex || sector.wallTex, 0xcc0000);
        scene.add(new THREE.Mesh(wallGeo, mat));
      }
    }

    buildStairsMeshes(scene, world, textures);
    buildSprites(scene, world, textures);
  }

  // ---------- Schema v2: grid de tiles (legacy) ----------

  static buildGridWorld(scene, world, textures) {
    const { map, sectorMap, sectors } = world;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        const sectorId = sectorMap[y][x];
        const sector = sectors[sectorId] || { floorH: 0, ceilH: 1 };

        if (tile > 0) {
          WorldMesh.buildWall(scene, x, y, tile, sector, textures);
        } else {
          WorldMesh.buildFloor(scene, x, y, sector, textures);
          WorldMesh.buildCeiling(scene, x, y, sector, textures);
        }
      }
    }
  }

  static buildWall(scene, x, y, tile, sector, textures) {
    const h = sector.ceilH - sector.floorH;
    const geo = new THREE.BoxGeometry(1, h, 1);
    const mat = makeMaterial(textures, tile, 0xffffff);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, sector.floorH + h / 2, y + 0.5);
    scene.add(mesh);
  }

  static buildFloor(scene, x, y, sector, textures) {
    const mat = makeMaterial(textures, 4, 0x555555, THREE.DoubleSide);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x + 0.5, sector.floorH, y + 0.5);
    scene.add(mesh);
  }

  static buildCeiling(scene, x, y, sector, textures) {
    const mat = makeMaterial(textures, 6, 0x888888, THREE.DoubleSide);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x + 0.5, sector.ceilH, y + 0.5);
    scene.add(mesh);
  }
}
