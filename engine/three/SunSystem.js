/**
 * SunSystem.js — cielo REALISTA 3D con ciclo día/noche (F4.7).
 *
 * Alternativa moderna al telón clásico Daggerfall (SkySystem). Usa el shader
 * atmosférico oficial de Three (`three/addons/objects/Sky.js`, dispersión
 * Rayleigh) para el cielo, y una DirectionalLight con sombras para el sol que
 * se mueve según la hora (daylight.js, lógica pura).
 *
 * Estructura en escena:
 *  - Sky (esfera gigante con shader atmosférico) + sol/luna visibles (sprites)
 *  - estrellas nocturnas (Points) que aparecen de noche
 *  - DirectionalLight como SOL (con shadow map PCF 2048) + luz hemisférica
 *
 * API simétrica a SkySystem: addTo(scene) / update(camera, hour, dt) / dispose().
 * OJO: update() avanza la hora SOLO si dayLengthSec > 0 (autoplay), en el
 * editor se queda fija salvo que el usuario la cambie (sin autoplay).
 */
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { sunDirection, paletteFor, advanceHour } from '../core/daylight.js';

const DEG = Math.PI / 180;

export class SunSystem {
  /**
   * @param {{hour?:number, dayLengthSec?:number, shadows?:boolean, sunTilt?:number}} cfg
   */
  constructor(cfg = {}) {
    this.cfg = { hour: 12, dayLengthSec: 0, shadows: true, sunTilt: 23.5, ...cfg };
    this.hour = this.cfg.hour;
    this._indoor = false;
    this.group = null;       // raíz de este sistema (se añade a la escena)
    this.sun = null;         // DirectionalLight
    this.hemi = null;        // HemisphereLight
    this.meshes = [];
    this.loaded = true;      // todo es procedural, no hay carga async
  }

  /** Construye todos los objetos 3D en un grupo y lo añade a la escena. */
  addTo(scene) {
    this.group = new THREE.Group();
    this.group.userData.isSky = true; // WorldMesh.clear los ignora

    this._addSky();
    this._addCelestialBodies();
    this._addStars();
    this._addLights();

    scene.add(this.group);
  }

  /** Shader atmosférico: el cielo realista (Rayleigh → atardeceres reales). */
  _addSky() {
    const sky = new Sky();
    sky.scale.setScalar(1000); // lo bastante grande para el frustum lejano
    // Como el telón clásico: profundidad desactivada y renderOrder NEGATIVO →
    // se dibuja PRIMERO (detrás de todo) y la geometría del mundo (que va
    // después, renderOrder 0) lo tapa donde hay muros. Sin depthTest no lo
    // recorta el plano far (cámara a 200 con esfera de 1000).
    sky.material.depthTest = false;
    sky.material.depthWrite = false;
    sky.renderOrder = -3;
    sky.frustumCulled = false; // la esfera nunca está entera en el frustum
    this.sky = sky;
    this.group.add(sky);
    this.skyUniforms = sky.material.uniforms;
  }

  /** Disco del sol y de la luna (bilboards siempre de frente a la cámara). */
  _addCelestialBodies() {
    // Disco del sol: sprite amarillo brillante. OPAQUE con alphaTest (los
    // bordes transparentes se descartan): se pinta en el pase opaco (renderOrder
    // -1 = detrás del mundo) y los muros lo tapan cuando está oculto — un sprite
    // transparente normal se dibujaría DESPUÉS del mundo y se colaría en las casas.
    const sunMat = new THREE.SpriteMaterial({
      map: this._makeDiskTexture(0xffddaa, 0.95),
      alphaTest: 0.5,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const sun = new THREE.Sprite(sunMat);
    sun.renderOrder = -1;
    sun.scale.set(14, 14, 1);
    this.sunSprite = sun;
    this.group.add(sun);

    // Disco de la luna: gris-blanco frío.
    const moonMat = new THREE.SpriteMaterial({
      map: this._makeDiskTexture(0xddddff, 0.7),
      alphaTest: 0.5,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const moon = new THREE.Sprite(moonMat);
    moon.renderOrder = -1;
    moon.scale.set(9, 9, 1);
    this.moonSprite = moon;
    this.group.add(moon);
  }

  /** Estrellas nocturnas: Points opacos con alphaTest; se "apagan" con tamaño 0. */
  _addStars() {
    const N = 400;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // Hemisferio superior, distribuido uniformemente.
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(Math.random()); // 0..π/2 hacia arriba
      positions[i * 3] = Math.sin(theta) * Math.cos(phi) * 900;
      positions[i * 3 + 1] = Math.cos(theta) * 900;
      positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * 900;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0, // 0 = invisible; lo enciende la noche (_applyPalette)
      alphaTest: 0.5,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.renderOrder = -2;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /** Luz principal (sol, con sombras) + luz hemisférica de ambiente. */
  _addLights() {
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    sun.castShadow = this.cfg.shadows;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 400;
      // Caja ortográfica centrada en el jugador (se actualiza en update()).
      const d = 60;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0005;
    }
    this.sun = sun;
    this.group.add(sun);

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x2a3a2a, 0.7);
    this.hemi = hemi;
    this.group.add(hemi);
  }

  /** Atenúa el sol en interiores (sector con techo real): Daggerfall-style. */
  setIndoor(indoor) {
    this._indoor = !!indoor;
  }

  /**
   * Actualiza el cielo con la hora actual (y avanza la hora si el día es
   * automático). Debe llamarse desde el bucle (Engine3D.update) con dt para
   * avanzar el reloj, y desde Renderer3D.render() con la cámara real para
   * colocar sol/luna/sombras. camera puede ser null (solo avanza el reloj).
   * @param {THREE.PerspectiveCamera|null} camera
   * @param {number} dt delta time (para advanceHour)
   */
  update(camera, dt = 0) {
    if (!this.group) return;
    if (this.cfg.dayLengthSec > 0) {
      this.hour = advanceHour(this.hour, dt, this.cfg.dayLengthSec);
    }
    this._applyPalette();
    if (camera) {
      this._placeCelestial();
      this._syncShadows(camera);
    }
  }

  /** Aplica la paleta de daylight.js a luces y shader atmosférico. */
  _applyPalette() {
    const p = paletteFor(this.hour);
    this.lastPalette = p;
    const indoorFactor = this._indoor ? 0.25 : 1; // interiores: sol tímido
    this.sun.color.setHex(p.sunColor);
    this.sun.intensity = p.sunIntensity * indoorFactor;

    this.hemi.color.setHex(p.skyColor);
    this.hemi.groundColor.setHex(p.groundColor);
    this.hemi.intensity = p.ambientIntensity * (this._indoor ? 1.4 : 1);

    // Shader (Sky): la posición del sol dirige el atardecer/color del cielo.
    const dir = sunDirection(this.hour, this.cfg.sunTilt);
    this.skyUniforms.sunPosition.value.set(dir.x * 100, dir.y * 100, dir.z * 100);

    // Estrellas: se "encienden" de noche cambiando el tamaño (con material
    // opaco, la opacidad no se ve; tamaño 0 = punto inexistente en raster).
    this.stars.material.size = p.night * 3;
  }

  /** Coloca sol y luna en la dirección celeste correspondiente a la hora. */
  /** Coloca sol y luna en la dirección celeste correspondiente a la hora. */
  _placeCelestial() {
    const dist = 500; // los sprites viven en la esfera del cielo
    const sd = sunDirection(this.hour, this.cfg.sunTilt);
    this.sunSprite.position.set(sd.x * dist, sd.y * dist, sd.z * dist);

    // La luna es el anti-sol.
    this.moonSprite.position.set(-sd.x * dist, -sd.y * dist, -sd.z * dist);
  }

  /** La cámara de sombras sigue al jugador (box ortográfica centrada en él). */
  _syncShadows(camera) {
    if (!this.sun.castShadow) return;
    const sd = sunDirection(this.hour, this.cfg.sunTilt);
    this.sun.position.copy(camera.position);
    this.sun.target.position.copy(camera.position).addScaledVector(
      new THREE.Vector3(sd.x, sd.y, sd.z), 10,
    );
    this.sun.position.add(new THREE.Vector3(-sd.x * 20, -sd.y * 20, -sd.z * 20));
    this.sun.updateMatrixWorld(true);
    this.sun.shadow.camera.updateProjectionMatrix();
  }

  dispose() {
    if (!this.group) return;
    for (const mesh of this.group.children) {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) {
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.dispose();
      }
    }
    this.group.removeFromParent();
    this.group = null;
  }

  /** Textura circular radial para un sprite (sol/luna). */
  _makeDiskTexture(color, alpha) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const r = size / 2;
    const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
    const col = '#' + color.toString(16).padStart(6, '0');
    grad.addColorStop(0, col);
    grad.addColorStop(0.7, col);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
}

/** Firma para el motor: estilo realista = este sistema.
 *  La HORA se excluye a propósito (como frame en classic): cambiarla solo
 *  actualiza el reloj en caliente (`Engine3D.setWorld` patchea `sun.hour`),
 *  no reconstruye el sistema completo. */
export function sunSignature(cfg) {
  return cfg && cfg.style === 'realista'
    ? JSON.stringify({ style: 'realista', dayLengthSec: cfg.dayLengthSec ?? 0, shadows: cfg.shadows ?? true, sunTilt: cfg.sunTilt ?? 23.5 })
    : null;
}