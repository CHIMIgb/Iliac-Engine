import * as THREE from 'three';
import { createFog } from './fog.js';

/**
 * Renderer3D — canvas WebGL + escena + cámara + luces.
 * Render a resolución nativa: el canvas ocupa el viewport y resize() lo sigue.
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

    this._createRenderer();
    this._addLights(renderSettings);
    this._bindContextLost();
    this.sky = null;   // SkySystem asignado por Engine3D; actualiza en render()
    this.sun = null;   // SunSystem (F4.7): el sol dicta luces, sombras y niebla
  }

  _defaultCreateRenderer(canvas) {
    return new THREE.WebGLRenderer({ canvas, antialias: false });
  }

  _createRenderer() {
    this.renderer = this.createRenderer(this.canvas);
    this.renderer.setSize(this.canvas.width, this.canvas.height, false);
    // Tipo de sombra del sol realista (F4.7) — se fija UNA vez al crear el
    // renderer (PCF: PCFSoftShadowMap se deprecó en r167 y r185 lo eliminó;
    // no reasignar por frame o el warning de Three se repite infinito).
    if (this.renderer.shadowMap) this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  _addLights(settings = {}) {
    const ambientCfg = settings.ambientLight ?? { color: 0xffffff, intensity: 0.6 };
    const ambient = new THREE.AmbientLight(ambientCfg.color, ambientCfg.intensity);
    this.scene.add(ambient);

    const dirCfg = settings.directionalLight ?? { color: 0xffffff, intensity: 0.7, position: [5, 10, 5] };
    const dir = new THREE.DirectionalLight(dirCfg.color, dirCfg.intensity);
    dir.position.set(...dirCfg.position);
    this.scene.add(dir);

    // Luces fijas por defecto (modo clásico). El cielo realista (SunSystem) las
    // sustituye por sol/luna dinámicos: setDefaultLights(false) al activarlo.
    this._defaultLights = [ambient, dir];
  }

  /** Oculta las luces fijas cuando el sol realista toma el control. */
  setDefaultLights(enabled) {
    for (const l of this._defaultLights || []) l.visible = enabled;
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
    this.sun?.update(this.camera, 0);
    // Niebla: el cielo realista tiñe la niebla con la hora (daylight.js).
    if (this.sun && this.scene.fog) {
      const fogColor = this.sun.lastPalette?.fogColor;
      if (fogColor != null) this.scene.fog.color.setHex(fogColor);
    }
    // Las sombras se activan dinámicamente si el sol existe con sombras.
    // Guard: el shadowMap puede faltar en stubs de test (renderer falso).
    // El TIPO ya se fijó en _createRenderer (PCF, no deprecado).
    if (this.renderer.shadowMap) {
      this.renderer.shadowMap.enabled = !!(this.sun && this.sun.sun?.castShadow);
    }
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
