function createTexture(width, height, fillFn) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const c = fillFn(x, y);
      const i = (y * width + x) * 4;
      data[i] = (c >> 16) & 255;
      data[i + 1] = (c >> 8) & 255;
      data[i + 2] = c & 255;
      data[i + 3] = 255;
    }
  }

  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = new ImageData(data, width, height);
    ctx.putImageData(img, 0, 0);
    return { img: canvas, data, width, height };
  }

  return { data, width, height };
}

export function makeTexture(baseColor, width = 64, height = 64) {
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;

  return createTexture(width, height, (x, y) => {
    const shade = 1 - (0.15 * ((x + y) % 8)) / 8;
    return (
      (Math.min(255, r * shade) << 16) |
      (Math.min(255, g * shade) << 8) |
      Math.min(255, b * shade)
    );
  });
}

function imageToTexture(img, width = 64, height = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  return { img: canvas, data, width, height };
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
