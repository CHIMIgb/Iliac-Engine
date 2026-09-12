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
 *  - aurora boreal (domo interior, GLSL procedural) colgando del polo norte
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
   * @param {{hour?:number, dayLengthSec?:number, shadows?:boolean, sunTilt?:number, sunIntensity?:number, moonIntensity?:number, stars?:boolean, aurora?:boolean, auroraIntensity?:number, auroraColor?:string}} cfg
   */
  constructor(cfg = {}) {
    this.cfg = {
      hour: 12, dayLengthSec: 0, shadows: true, sunTilt: 23.5,
      sunIntensity: 0.85, moonIntensity: 0.55, stars: true,
      // F4.7 aurora boreal: cortina de luz en el polo norte, color configurable.
      aurora: true, auroraIntensity: 1, auroraColor: '#7dffb0',
      ...cfg,
    };
    this.hour = this.cfg.hour;
    this._indoor = false;
    this.group = null;       // raíz de este sistema (se añade a la escena)
    this.sun = null;         // DirectionalLight (sol, con sombras)
    this.moon = null;        // DirectionalLight (luna, sin sombras, F4.7)
    this.hemi = null;        // HemisphereLight
    this.stars = null;       // Points con shader propio
    this.aurora = null;      // domo interior BackSide (aurora boreal, F4.7)
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
    this._addAurora();
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

  /** Estrellas nocturnas: Points con shader propio (parpadeo por estrella). */
  _addStars() {
    // Posiciones en radio 1 (hemisferio superior). update() las escala al far
    // de la cámara real (×0.8): si se generaran a radio fijo (p.ej. 900) y el
    // proyecto usa far 500 quedarían TODAS recortadas por el plano lejano.
    const N = 400;
    const positions = new Float32Array(N * 3);
    const seeds = new Float32Array(N); // fase de parpadeo distinta por estrella
    for (let i = 0; i < N; i++) {
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.acos(Math.random()); // 0..π/2 hacia arriba
      positions[i * 3] = Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = Math.cos(theta);
      positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    // Shader opaco con alphaTest (igual que los discos sol/luna): se pinta en
    // el pase OPACO (renderOrder -2, detrás del mundo) y las paredes lo tapan.
    // El parpadeo modula el ALPHA: con alphaTest 0.5 cada estrella aparece y
    // desaparece según su fase (sin blending, que colaría el cielo en casas).
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: 0 }, // 0 = invisible; lo enciende la noche (_applyPalette)
      },
      vertexShader: `
        attribute float seed;
        uniform float uSize;
        varying float vSeed;
        void main() {
          vSeed = seed;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = uSize; // tamaño FIJO en píxeles (1 px de noche)
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying float vSeed;
        void main() {
          // Tintineo: onda senoidal por fase aleatoria, con suelo 0.35 para
          // que nunca se apaguen del todo; alphaTest 0.5 recorta lo tenue.
          float tw = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.0 + vSeed * 6.2831));
          gl_FragColor = vec4(1.0, 1.0, 1.0, tw);
        }
      `,
      alphaTest: 0.5,
      transparent: false,
      depthTest: false,
      depthWrite: false,
    });
    this.stars = new THREE.Points(geo, mat);
    this.stars.renderOrder = -2;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /**
   * Aurora boreal (F4.7): cortina de luz en el polo norte, color configurable.
   *
   * Un domo interior (radio 1, escalado al far real en update()) con un shader
   * procedural GLSL (adaptado del Shadertoy "Auroras" de nimitz, XtGGRt): cada
   * fragmento marcha un rayo por el cielo y acumula densidad de "cortina" con
   * ruido triangular (_triNoise2d, 5 octavas) → bandas verticales ondeando con
   * el tiempo. La paleta natural (verde→cian→violeta) sale de una onda senoidal
   * sobre la altura de cada paso; el color del usuario (`auroraColor`, uColor)
   * se mezcla al 65 % manteniendo la forma de las bandas.
   *
   * El domo usa BLENDING ADITIVO + depthTest: la aurora suma luz sobre el cielo
   * nocturno y queda oculta tras los muros (el mundo escribe depth); se ve a
   * través de ventanas y por encima de los muros, como la de verdad. Es
   * translúcida: la opacidad se modula con uNight*uIntensity en el alpha.
   *
   * Solo aparece de noche (uNight = p.night de daylight.js): de día el alpha es
   * 0 y el blending aditivo no aporta nada. El toggle `aurora:false` la oculta
   * por completo (visible=false).
   */
  _addAurora() {
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uNight: { value: 0 },
        uIntensity: { value: this.cfg.auroraIntensity },
        uColor: { value: hexToRgb01(this.cfg.auroraColor) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uNight;
        uniform float uIntensity;
        uniform vec3 uColor;
        varying vec3 vWorldPos;

        // Ruido triangular (nimitz): barato y con bandas naturales para la cortina.
        mat2 mm2(in float a){ float c=cos(a), s=sin(a); return mat2(c, s, -s, c); }
        float tri(in float x){ return clamp(abs(fract(x)-.5), 0.01, 0.49); }
        vec2 tri2(in vec2 p){ return vec2(tri(p.x)+tri(p.y), tri(p.y+tri(p.x))); }
        // Rotación fija del torrente (constante del shader original).
        const mat2 M2 = mat2(0.95534, -0.29552, 0.29552, 0.95534);

        float hash21(vec2 n){ return fract(sin(dot(n, vec2(12.9898, 4.1414)))*43758.5453); }

        float triNoise2d(in vec2 p, float spd){
          float z = 1.8;
          float z2 = 2.5;
          float rz = 0.;
          p *= mm2(p.x*0.06);
          vec2 bp = p;
          for(int i = 0; i < 5; i++){
            vec2 dg = tri2(bp*1.85)*.75;
            dg *= mm2(uTime*spd);
            p -= dg/z2;
            bp *= 1.3;
            z2 *= .45;
            z *= .42;
            p *= 1.21 + (rz - 1.0)*.02;
            rz += tri(p.x + tri(p.y))*z;
            p *= -M2;
          }
          return clamp(1.0/pow(rz*29.0, 1.3), 0.0, .7);
        }

        // Ray-march liviano de las cortinas por la dirección del cielo.
        vec4 aurora(in vec3 ro, in vec3 rd){
          vec4 col = vec4(0.0);
          vec4 avgCol = vec4(0.0);
          for(float i = 0.; i < 50.; i++){
            float of = 0.006*hash21(gl_FragCoord.xy)*smoothstep(0., 15., i);
            float pt = ((.8 + pow(i, 1.4)*.002) - ro.y) / (rd.y*2. + 0.4);
            pt -= of;
            vec3 bpos = ro + pt*rd;
            vec2 p = bpos.zx;
            float rzt = triNoise2d(p, 0.06);
            vec4 col2 = vec4(0., 0., 0., rzt);
            // Paleta natural (senoidal por paso) MEZCLADA 65 % con el color del
            // usuario (auroraColor): la forma de las bandas se conserva, el
            // tono dominante es el elegido.
            vec3 natural = (sin(1. - vec3(2.15, -.5, 1.2) + i*0.043)*.5 + .5)*rzt;
            col2.rgb = mix(natural, uColor*rzt, 0.65);
            avgCol = mix(avgCol, col2, .5);
            // Ganancia elevada (exp2 menos agresivo + clamp del ruido a .7):
            // la cortina se ve MÁS MARCADA, incluso cerca del horizonte.
            col += avgCol*exp2(-i*0.05 - 1.9)*smoothstep(0., 5., i);
          }
          col *= (clamp(rd.y*12. + .35, 0., 1.));
          return col;
        }

        void main(){
          // Dirección del rayo: del fragmento (en el domo del cielo) a la cámara.
          vec3 rd = normalize(vWorldPos - cameraPosition);
          // Aurora solo hacia el polo norte del mundo (-Z): cerca del horizonte
          // norte la cortina se ve de canto y BAJA hasta casi el propio horizonte
          // (smoothstep arranca en 0.005 → el efecto se ve más lejos y más abajo).
          float north = clamp(dot(vec3(0., 0., -1.), normalize(vec3(rd.x, 0., rd.z))), 0., 1.);
          float sky = smoothstep(0.005, 0.12, rd.y); // solo sobre horizonte
          vec4 c = aurora(vec3(0.), rd);
          float alpha = c.a * uNight * uIntensity * north * sky;
          vec3 rgb = c.rgb * uIntensity * uNight * north * sky;
          gl_FragColor = vec4(rgb, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true,
      side: THREE.BackSide,
      fog: false,
    });
    this.aurora = new THREE.Mesh(geo, mat);
    this.aurora.renderOrder = -2;
    this.aurora.frustumCulled = false; // domo gigante, nunca entero en el frustum
    this.group.add(this.aurora);
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

    // Luz de la luna (F4.7): una DirectionalLight fría SIN sombras que solo
    // ilumina de noche (la enciende _applyPalette según moonIntensity). La
    // luna es el anti-sol, así que su luz llega desde la dirección opuesta.
    const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
    moon.castShadow = false;
    this.moon = moon;
    this.group.add(moon);

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
      // Escala las estrellas al alcance visual real de la cámara (×0.8 del
      // far): siempre dentro del view frustum, por lejos que llegue el far.
      this.stars.scale.setScalar(Math.max(10, camera.far * 0.8));
      // La aurora (domo interior) también escala al far: el march de rayos
      // depende solo de la DIRECCIÓN (rd), el radio solo hace de pantalla.
      this.aurora.scale.setScalar(Math.max(10, camera.far * 0.8));
      this._placeCelestial(camera);
      this._syncShadows(camera);
    }
  }

  /** Aplica la paleta de daylight.js a luces y shader atmosférico. */
  _applyPalette() {
    const p = paletteFor(this.hour);
    this.lastPalette = p;
    const indoorFactor = this._indoor ? 0.25 : 1; // interiores: sol tímido
    // F4.7: sunIntensity multiplica el sol (configurable desde el editor).
    this.sun.color.setHex(p.sunColor);
    this.sun.intensity = p.sunIntensity * this.cfg.sunIntensity * indoorFactor;

    this.hemi.color.setHex(p.skyColor);
    this.hemi.groundColor.setHex(p.groundColor);
    this.hemi.intensity = p.ambientIntensity * (this._indoor ? 1.4 : 1);

    // F4.7: la luna ilumina de noche (anti-solar). El día no aporta nada.
    // En interiores se atenúa igual que el sol (Daggerfall-style).
    this.moon.intensity = p.night * this.cfg.moonIntensity * indoorFactor;

    // Shader (Sky): la posición del sol dirige el atardecer/color del cielo.
    const dir = sunDirection(this.hour, this.cfg.sunTilt);
    this.skyUniforms.sunPosition.value.set(dir.x * 100, dir.y * 100, dir.z * 100);

    // Estrellas: se "encienden" de noche cambiando el tamaño (con material
    // opaco, la opacidad no se ve; tamaño 0 = punto inexistente en raster).
    // F4.7: el toggle stars las oculta por completo. Tamaño exacto de 1 px (el
    // vertex shader usa uSize directamente como gl_PointSize) y parpadeo por
    // tiempo real — el shader modula el alpha por fase, así que el alphaTest
    // recorta las estrellas tenues: eso es el tintineo.
    this.stars.visible = this.cfg.stars;
    const uni = this.stars.material.uniforms;
    uni.uSize.value = p.night * 1.0;
    uni.uTime.value = performance.now() * 0.001;

    // Aurora boreal: se enciende de noche (uNight), con su intensidad propia
    // (slider del editor), una animación siempre viva (uTime real) y el color
    // elegido (auroraColor, picker del editor). El destino `aurora` combina
    // alpha y rgb (blending aditivo) → translúcida sin brillar de día (uNight 0
    // apaga el producto).
    this.aurora.visible = this.cfg.aurora;
    const au = this.aurora.material.uniforms;
    au.uNight.value = p.night;
    au.uIntensity.value = this.cfg.auroraIntensity;
    au.uColor.value = hexToRgb01(this.cfg.auroraColor);
    au.uTime.value = performance.now() * 0.001;
  }

  /** Coloca sol y luna en la dirección celeste correspondiente a la hora. */
  _placeCelestial(camera) {
    const dist = 500; // los sprites viven en la esfera del cielo
    const sd = sunDirection(this.hour, this.cfg.sunTilt);
    this.sunSprite.position.set(sd.x * dist, sd.y * dist, sd.z * dist);

    // La luna es el anti-sol.
    this.moonSprite.position.set(-sd.x * dist, -sd.y * dist, -sd.z * dist);

    // La luz lunar (DirectionalLight) se ancla a la cámara como el sol, pero
    // con el rayo invertido: el sol viaja desde -sd hacia +sd (con sombras),
    // la luna entra desde la dirección lunar (anti-solar).
    if (this.moon && camera) {
      const v = new THREE.Vector3(sd.x, sd.y, sd.z);
      this.moon.position.copy(camera.position).addScaledVector(v, 20);
      this.moon.target.position.copy(camera.position).addScaledVector(v, -10);
      this.moon.target.updateMatrixWorld();
      this.moon.updateMatrixWorld();
    }
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

/** Hex `#rrggbb` → tres componentes 0–1 (para el uniform uColor de la aurora). */
export function hexToRgb01(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16) / 255,
    g: parseInt(h.slice(2, 4), 16) / 255,
    b: parseInt(h.slice(4, 6), 16) / 255,
  };
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