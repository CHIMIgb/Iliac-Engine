import * as THREE from 'three';
import { animFrameIndex } from '../core/anims.js';

/**
 * SpriteSystem — sprites billboard 2D sobre el mundo 3D.
 *
 * Dos modos (mismo contrato world.sprites[]):
 *  - sprite SIN `anim` → textura estática (comportamiento histórico, intacto).
 *  - sprite CON `anim` (id en world.spriteAnims) → anima los frames de la
 *    animación: el material del Sprite cambia su `map` por frame según el
 *    reloj acumulado. La lógica de índice está en core/anims.js (pura).
 *
 * buildSprites devuelve un `SpriteAnimator` con `update(dt)` para que el
 * orquestador (Engine3D) lo avance cada frame — o null si no hay sprites
 * animados (cero coste por frame en mundos sin animaciones).
 */

/** Detección rápida: ¿este mundo tiene animaciones de sprites? */
function hasAnims(world) {
  return !!(world.spriteAnims && Object.keys(world.spriteAnims).length > 0);
}

/**
 * Estilo de textura pixelado para sprites (mismos flags que el clásico).
 * @returns {THREE.Texture | undefined}
 */
function pixelate(tex) {
  if (!tex) return undefined;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildSprites(scene, world, textures) {
  const anims = world.spriteAnims || {};
  const animated = [];
  for (const sprite of world.sprites || []) {
    const animDef = sprite.anim ? anims[sprite.anim] : null;
    if (animDef && Array.isArray(animDef.frames) && animDef.frames.length > 0) {
      // Sprite animado: un único Sprite; el material cambia de frame por update().
      const firstTex = pixelate(textures[animDef.frames[0]]);
      if (!firstTex) continue;
      const material = new THREE.SpriteMaterial({ map: firstTex });
      const s = new THREE.Sprite(material);
      s.position.set(sprite.pos.x, sprite.pos.z, sprite.pos.y);
      const scale = sprite.scale ?? 1;
      s.scale.set(scale, scale, 1);
      scene.add(s);
      animated.push({ sprite: s, animDef, clock: 0, last: -1 });
      // El resto de frames también se pixelan una sola vez aquí (al activarse).
      for (const key of animDef.frames) pixelate(textures[key]);
      continue;
    }
    // Sprite estático (clásico).
    const tex = pixelate(textures[sprite.tex]);
    if (!tex) continue;
    const material = new THREE.SpriteMaterial({ map: tex });
    const s = new THREE.Sprite(material);
    s.position.set(sprite.pos.x, sprite.pos.z, sprite.pos.y);
    const scale = sprite.scale ?? 1;
    s.scale.set(scale, scale, 1);
    scene.add(s);
  }
  if (animated.length === 0) return null;
  return {
    /** Avanza los relojes y cambia el frame de cada sprite animado. */
    update(dt) {
      const safe = Math.max(0, dt || 0);
      for (const entry of animated) {
        entry.clock += safe;
        const idx = animFrameIndex(entry.animDef, entry.clock);
        if (idx === entry.last) continue;
        entry.last = idx;
        const tex = textures[entry.animDef.frames[idx]];
        if (tex && entry.sprite.material.map !== tex) {
          entry.sprite.material.map = tex;
          entry.sprite.material.needsUpdate = true;
        }
      }
    },
    get count() {
      return animated.length;
    },
  };
}