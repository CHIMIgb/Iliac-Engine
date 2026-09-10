/**
 * SkySystem.js — horizonte lejano estilo Daggerfall.
 *
 * Los assets `The Sky` de Daggerfall son 31 sets (SKY00–SKY30, uno por hora
 * del día/tiempo). Cada set trae 2 capas en paralaje (0 = lejana: montañas y
 * nubes; 1 = cercana: silueta de bosque sobre el horizonte) y 32 fotogramas
 * de 512×220: VENTANAS precalculadas de la panorámica. Al girar la cámara no
 * se desplaza el UV: se CAMBIA de fotograma (el truco original, sin costuras).
 *
 * Render: dos cilindros parciales (arco ~110°) sin iluminación, sin niebla y
 * sin escribir profundidad, que siguen a la cámara → se ven infinitamente
 * lejos. El fondo/neblina bajo el horizonte sigue siendo el color del renderer.
 */
import * as THREE from 'three';
import { loadTextures } from './textures.js';

export const SKY_SETS = 31;
export const SKY_FRAMES = 32;
const LAYERS = ['far', 'near'];
const ARC = Math.PI / 2 + 0.27; // ventana por fotograma (rad)
// Radio por debajo del `far` de la cámara (200): con depthTest:false y
// renderOrder negativo el cielo se pinta SIEMPRE detrás del mundo.
const R_FAR = 90;
const R_NEAR = 84;
// ponytail: estas alturas/base son "a ojo" — calibrar en el playtest (H cubre
// el ángulo vertical de la banda, BASE el offset bajo el centro de cámara).
const H_FAR = 72;
const H_NEAR = 36;
const BASE_FAR = -1;
const BASE_NEAR = -2.4;
// 0.5 (no 0.6): con 32 frames, 32·0.5=16 entero → tras una vuelta completa de
// 360° la capa lejana vuelve AL MISMO fotograma (sin salto al cerrar el giro).
const PARALLAX_FAR = 0.5;  // la capa lejana gira al 50 % de la velocidad

/** Índice de fotograma [0,frames) para un yaw (rad), envolvente y para negativos. */
export function skyFrameIndex(yaw, frames = SKY_FRAMES) {
  const TAU = Math.PI * 2;
  const norm = ((yaw % TAU) + TAU) % TAU;
  return Math.floor((norm / TAU) * frames) % frames;
}

/** URL del PNG de un set/capa/frame (con stride, frames se mapean a 0,2,4…). */
export function skyFrameUrl(base, set, layer, frame) {
  return `${base}SKY${String(set).padStart(2, '0')}/${layer}-${frame}.PNG`;
}

/** Firma para detectar cambios de cielo en el reload en vivo. */
export function skySignature(cfg) {
  return JSON.stringify(cfg ?? null);
}

export class SkySystem {
  /**
   * @param {{set:number, stride?:1|2, base?:string}} cfg
   */
  constructor(cfg = {}) {
    this.set = Number.isInteger(cfg.set) ? cfg.set : null;
    this.stride = cfg.stride === 2 ? 2 : 1;
    this.base = cfg.base ?? '/sky/';
    this.textures = {};
    this.meshes = [];
    this.loaded = false;
  }

  /** Carga todas las texturas del set (una vez, en paralelo). */
  async load() {
    if (this.set == null) return;
    const n = Math.floor(SKY_FRAMES / this.stride);
    const defs = {};
    for (let l = 0; l < LAYERS.length; l++) {
      for (let f = 0; f < n; f++) {
        defs[`${l}:${f}`] = encodeURI(skyFrameUrl(this.base, this.set, l, f * this.stride));
      }
    }
    this.textures = await loadTextures(defs);
    this.loaded = true;
  }

  addTo(scene) {
    if (!this.loaded) return;
    for (let l = 0; l < LAYERS.length; l++) {
      const near = l === 1;
      const geo = new THREE.CylinderGeometry(
        near ? R_NEAR : R_FAR, near ? R_NEAR : R_FAR,
        near ? H_NEAR : H_FAR, 48, 1, true, -ARC / 2, ARC,
      );
      const mat = new THREE.MeshBasicMaterial({
        map: this.textures[`${l}:0`],
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.BackSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = near ? -2 : -3;     // cielo: primero lo lejos, luego lo cerca
      mesh.frustumCulled = false;            // sigue a la cámara: no recortar nunca
      mesh.userData.isSky = true;            // WorldMesh.clear debe saltarlos
      mesh.userData.layer = l;
      mesh.userData.base = near ? BASE_NEAR : BASE_FAR;
      this.meshes.push(mesh);
      scene.add(mesh);
    }
  }

  /** Cada frame: seguir a la cámara, elegir fotograma por yaw y apuntar el arco. */
  update(camera) {
    if (!this.loaded || this.meshes.length === 0) return;
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    const yaw = Math.atan2(d.z, d.x); // convención Engine3D: (cos yaw, sin yaw) en XZ
    const n = Math.floor(SKY_FRAMES / this.stride);
    for (const mesh of this.meshes) {
      const l = mesh.userData.layer;
      const near = l === 1;
      mesh.position.set(camera.position.x, camera.position.y - mesh.userData.base, camera.position.z);
      // El arco SIEMPRE mira al frente de la cámara (la ventana es fija);
      // el paralaje vive solo en la ELECCIÓN del fotograma. (Rotar el arco
      // con el ángulo del paralaje duplicaba el horizonte en el playtest.)
      mesh.rotation.y = Math.PI / 2 - yaw;
      const f = skyFrameIndex(near ? yaw : yaw * PARALLAX_FAR, n);
      const tex = this.textures[`${l}:${f}`];
      if (tex && mesh.material.map !== tex) {
        mesh.material.map = tex;
      }
    }
  }

  dispose() {
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.material.dispose();
      m.removeFromParent();
    }
    this.meshes = [];
    for (const tex of Object.values(this.textures)) tex.dispose?.();
    this.textures = {};
    this.loaded = false;
  }
}
