import * as THREE from 'three';

const colorTextureCache = new Map();

export async function loadTextures(textureDefs) {
  const textures = {};
  const loader = new THREE.TextureLoader();
  const pending = [];

  for (const key in textureDefs) {
    const def = textureDefs[key];
    if (typeof def === 'string') {
      pending.push(
        loader.loadAsync(def).then((tex) => {
          textures[key] = tex;
        }),
      );
    } else if (typeof def === 'number') {
      textures[key] = colorTexture(def);
    }
  }

  await Promise.all(pending);

  // Filtros y colorSpace se aplican una sola vez por textura, no en cada material.
  for (const tex of Object.values(textures)) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
  }

  return textures;
}

export function colorTexture(hex) {
  const cached = colorTextureCache.get(hex);
  if (cached) return cached;

  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  colorTextureCache.set(hex, tex);
  return tex;
}

export function makeMaterial(textures, id, fallbackColor, side = THREE.FrontSide) {
  const tex = textures[id];
  if (tex) {
    return new THREE.MeshStandardMaterial({ map: tex, side });
  }
  return new THREE.MeshStandardMaterial({ color: fallbackColor, side });
}
