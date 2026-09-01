import * as THREE from 'three';

export class Renderer3D {
  constructor(map, colors, canvas) {
    this.map = map;
    this.colors = colors;
    this.canvas = canvas;
    this.paused = false;

    // Escena
    this.scene = new THREE.Scene();

    // Cámara
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.canvas.clientWidth / this.canvas.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(4, 5, 12);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      alpha: false,
    });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

    // Luz direccional
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 7.5);
    this.scene.add(dirLight);

    // Luz ambiental
    this.scene.add(new THREE.AmbientLight(0x404040));

    // Crear cubos del mapa
    this.tileSize = 1;
    this.createMap();

    // Loop de render
    this.animateId = null;
    this.render();
  }

  createMap() {
    const map = this.map;
    const tileSize = this.tileSize;

    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        if (tile === 0) continue;

        const position = new THREE.Vector3(
          x * tileSize,
          -y * tileSize,
          0
        );

        const geometry = new THREE.BoxGeometry(tileSize, tileSize, tileSize);

        let color;
        switch (tile) {
          case 1:
            color = this.colors.wall || 0xcc0000;
            break;
          case 2:
            color = this.colors.floor || 0x00cc00;
            break;
          case 3:
            color = this.colors.ceiling || 0x0000cc;
            break;
          case 4:
          case 5:
            color = this.colors.floor2 || 0x555555;
            break;
          case 6:
            color = this.colors.ceiling || 0x888888;
            break;
          default:
            color = 0xffffff;
        }

        const material = new THREE.MeshStandardMaterial({ color });
        const cube = new THREE.Mesh(geometry, material);
        cube.position.copy(position);
        this.scene.add(cube);
      }
    }
  }

  animate() {
    this.scene.rotation.y += 0.005;
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
    this.animateId = requestAnimationFrame(this.animate);
  }

  start() {
    if (!this.paused) {
      this.render();
    }
  }

  stop() {
    this.paused = true;
    if (this.animateId) {
      cancelAnimationFrame(this.animateId);
    }
  }
}