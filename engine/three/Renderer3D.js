import * as THREE from 'three';

export class Renderer3D {
  constructor(canvas, renderSettings = {}) {
    this.canvas = canvas;
    this.renderSettings = renderSettings;
    this.createRenderer = renderSettings.createRenderer || this._defaultCreateRenderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(renderSettings.backgroundColor ?? 0x202020);

    this.camera = new THREE.PerspectiveCamera(
      renderSettings.fov ?? 75,
      canvas.width / canvas.height,
      renderSettings.near ?? 0.05,
      renderSettings.far ?? 200,
    );

    this._createRenderer();
    this._addLights(renderSettings);
    this._bindContextLost();
  }

  _defaultCreateRenderer(canvas) {
    return new THREE.WebGLRenderer({ canvas, antialias: false });
  }

  _createRenderer() {
    this.renderer = this.createRenderer(this.canvas);
    this.renderer.setSize(this.canvas.width, this.canvas.height, false);
  }

  _addLights(settings = {}) {
    const ambientCfg = settings.ambientLight ?? { color: 0xffffff, intensity: 0.6 };
    const ambient = new THREE.AmbientLight(ambientCfg.color, ambientCfg.intensity);
    this.scene.add(ambient);

    const dirCfg = settings.directionalLight ?? { color: 0xffffff, intensity: 0.7, position: [5, 10, 5] };
    const dir = new THREE.DirectionalLight(dirCfg.color, dirCfg.intensity);
    dir.position.set(...dirCfg.position);
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
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    if (this.contextLost) return;
    this.renderer.dispose();
    this.contextLost = true;
  }
}
