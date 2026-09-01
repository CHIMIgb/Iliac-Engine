import * as THREE from 'three';

export class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);

    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.05,
      200,
    );

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
    });
    this.renderer.setSize(canvas.width, canvas.height);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
  }

  clearWorld() {
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      const child = this.scene.children[i];
      if (child.isMesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
        this.scene.remove(child);
      }
    }
  }

  buildWorld(project, textures) {
    this.clearWorld();

    const { map, sectorMap, sectors } = project.world;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        const sectorId = sectorMap[y][x];
        const sector = sectors[sectorId] || { floorH: 0, ceilH: 1 };

        if (tile > 0) {
          const h = sector.ceilH - sector.floorH;
          const geo = new THREE.BoxGeometry(1, h, 1);
          const mat = this.materialFor(textures, tile, 0xffffff);
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(x + 0.5, sector.floorH + h / 2, y + 0.5);
          this.scene.add(mesh);
        } else {
          this.buildFloor(x, y, sector, textures);
          this.buildCeiling(x, y, sector, textures);
        }
      }
    }
  }

  buildFloor(x, y, sector, textures) {
    const mat = this.materialFor(textures, 4, 0x555555);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x + 0.5, sector.floorH, y + 0.5);
    this.scene.add(mesh);
  }

  buildCeiling(x, y, sector, textures) {
    const mat = this.materialFor(textures, 6, 0x888888);
    const geo = new THREE.PlaneGeometry(1, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(x + 0.5, sector.ceilH, y + 0.5);
    this.scene.add(mesh);
  }

  materialFor(textures, id, fallbackColor) {
    const tex = textures[id];
    if (tex) {
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex });
    }
    return new THREE.MeshStandardMaterial({ color: fallbackColor });
  }

  syncCamera(player) {
    const px = player.posX;
    const py = player.posZ;
    const pz = player.posY;

    const fx = Math.cos(player.pitch) * Math.cos(player.yaw);
    const fy = Math.sin(player.pitch);
    const fz = Math.cos(player.pitch) * Math.sin(player.yaw);

    this.camera.position.set(px, py, pz);
    this.camera.lookAt(px + fx, py + fy, pz + fz);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
