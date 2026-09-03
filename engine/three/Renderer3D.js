import * as THREE from 'three';

export class Renderer3D {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.createRenderer = opts.createRenderer || this._defaultCreateRenderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);

    this.camera = new THREE.PerspectiveCamera(
      75,
      canvas.width / canvas.height,
      0.05,
      200,
    );

    this._createRenderer();
    this._addLights();
    this._bindContextLost();
  }

  _defaultCreateRenderer(canvas) {
    return new THREE.WebGLRenderer({ canvas, antialias: false });
  }

  _createRenderer() {
    this.renderer = this.createRenderer(this.canvas);
    this.renderer.setSize(this.canvas.width, this.canvas.height);
  }

  _addLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 10, 5);
    this.scene.add(dir);
  }

  // Manejo de webglcontextlost: Three.js necesita poder restaurar el contexto
  // (preventDefault) y recrear el renderer al restaurarse.
  _bindContextLost() {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.contextLost = true;
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      // Los bufos de geometría se re-suben en el próximo render; solo hace
      // falta recrear el renderer sobre el contexto restaurado.
      this._createRenderer();
      this.resize(this.canvas.width, this.canvas.height);
    });
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
    if (this.contextLost) return;
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    if (this.contextLost) return;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.contextLost) return;
    this.renderer.dispose();
    this.contextLost = true;
  }
}
