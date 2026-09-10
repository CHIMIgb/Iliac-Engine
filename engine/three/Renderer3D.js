import * as THREE from 'three';
import { createFog } from './fog.js';

/**
 * Renderer3D — canvas WebGL + escena + cámara + luces.
 *
 * project.render.resolution permite fijar un buffer interno pequeño
 * (p. ej. [320,200], la resolución nativa de Daggerfall) que el navegador
 * estira con píxel duro: look retro y render más barato.
 */
export class Renderer3D {
  constructor(canvas, renderSettings = {}) {
    this.canvas = canvas;
    this.renderSettings = renderSettings;
    this.createRenderer = renderSettings.createRenderer || this._defaultCreateRenderer;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(renderSettings.backgroundColor ?? 0x202020);

    // Niebla atmosférica opcional: la lee de project.json (render.fog).
    this.scene.fog = createFog(renderSettings.fog, renderSettings.backgroundColor ?? 0x202020);

    this.camera = new THREE.PerspectiveCamera(
      renderSettings.fov ?? 75,
      canvas.width / canvas.height,
      renderSettings.near ?? 0.05,
      renderSettings.far ?? 200,
    );

    // Resolución interna de render [ancho, alto] (p. ej. [320,200]); null = nativa.
    this.fixedRes = Array.isArray(renderSettings.resolution) && renderSettings.resolution.length === 2
      ? [Math.round(renderSettings.resolution[0]), Math.round(renderSettings.resolution[1])]
      : null;

    this._createRenderer();
    this._addLights(renderSettings);
    this._bindContextLost();
    this.sky = null; // SkySystem asignado por Engine3D; actualiza en render()
  }

  _defaultCreateRenderer(canvas) {
    return new THREE.WebGLRenderer({ canvas, antialias: false });
  }

  _createRenderer() {
    this.renderer = this.createRenderer(this.canvas);
    if (this.fixedRes) {
      // Buffer fijo bajo: el navegador estira el canvas al CSS con píxeles
      // duros = look retro. El aspect de cámara sigue al buffer, no a la ventana.
      this.renderer.setSize(this.fixedRes[0], this.fixedRes[1], false);
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.imageRendering = 'pixelated';
      this.camera.aspect = this.fixedRes[0] / this.fixedRes[1];
    } else {
      this.renderer.setSize(this.canvas.width, this.canvas.height, false);
    }
    this.camera.updateProjectionMatrix();
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
      // Los buferes de geometría se re-suben en el próximo render; solo hace
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
    // El cielo sigue a la cámara real (orbit del editor o jugador): mismo
    // punto de enganche para ambos modos.
    this.sky?.update(this.camera);
    this.renderer.render(this.scene, this.camera);
  }

  resize(width, height) {
    if (this.contextLost) return;
    if (this.fixedRes) return; // buffer fijo del playtest: la ventana no lo cambia
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
