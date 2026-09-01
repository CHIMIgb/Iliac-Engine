import * as THREE from 'three';
import { makeMaterial } from './textures.js';

export class WorldMesh {
  static build(scene, project, textures) {
    WorldMesh.clear(scene);

    const { map, sectorMap, sectors } = project.world;

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

  static buildWall(scene, x, y, tile, sector, textures) {
    const h = sector.ceilH - sector.floorH;
    const geo = new THREE.BoxGeometry(1, h, 1);
    const mat = makeMaterial(textures, tile, 0xffffff);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x + 0.5, sector.floorH + h / 2, y + 0.5);
    scene.add(mesh);
  }

  static buildFloor(scene, x, y, sector, textures) {
    const mat = makeMaterial(textures, 4, 0x555555);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x + 0.5, sector.floorH, y + 0.5);
    scene.add(mesh);
  }

  static buildCeiling(scene, x, y, sector, textures) {
    const mat = makeMaterial(textures, 6, 0x888888);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x + 0.5, sector.ceilH, y + 0.5);
    scene.add(mesh);
  }
}
