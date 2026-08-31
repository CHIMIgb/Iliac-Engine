export function makeTexture(baseColor, width = 64, height = 64) {
  const tex = new Uint32Array(width * height);
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = 1 - (0.15 * ((x + y) % 8)) / 8;
      tex[y * width + x] =
        (Math.min(255, r * shade) << 16) |
        (Math.min(255, g * shade) << 8) |
        Math.min(255, b * shade);
    }
  }
  return tex;
}

function imageToTexture(img, width = 64, height = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const tex = new Uint32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const j = i * 4;
    tex[i] = (data[j] << 16) | (data[j + 1] << 8) | data[j + 2];
  }
  return tex;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`No se pudo cargar la textura: ${src}`));
    img.src = src;
  });
}

export async function loadTextures(textureDefs, width = 64, height = 64) {
  const textures = {};
  for (const key in textureDefs) {
    const def = textureDefs[key];
    if (typeof def === 'number') {
      textures[key] = makeTexture(def, width, height);
    } else if (typeof def === 'string') {
      textures[key] = imageToTexture(await loadImage(def), width, height);
    } else {
      throw new Error(`Definición de textura inválida para el tile ${key}`);
    }
  }
  return textures;
}
