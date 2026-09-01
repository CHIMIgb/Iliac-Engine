import * as THREE from 'three';

export async function loadTextures(textureDefs) {
  const textures = {};
  const loader = new THREE.TextureLoader();
  for (const key in textureDefs) {
    const def = textureDefs[key];
    if (typeof def === 'string') {
      textures[key] = await loader.loadAsync(def);
    } else if (typeof def === 'number') {
      textures[key] = colorTexture(def);
    }
  }
  return textures;
}

export function colorTexture(hex) {
  const r = ((hex >> 16) & 255) / 255;
  const g = ((hex >> 8) & 255) / 255;
  const b = (hex & 255) / 255;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function makeMaterial(textures, id, fallbackColor, side = THREE.FrontSide) {
  const tex = textures[id];
  if (tex) {
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: tex, side });
  }
  return new THREE.MeshStandardMaterial({ color: fallbackColor, side });
}
