export function makeTexture(baseColor, width = 64, height = 64) {
  const tex = new Uint32Array(width * height);
  const r = (baseColor >> 16) & 255;
  const g = (baseColor >> 8) & 255;
  const b = baseColor & 255;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const shade = 1 - 0.15 * ((x + y) % 8) / 8;
      tex[y * width + x] =
        (Math.min(255, r * shade) << 16) |
        (Math.min(255, g * shade) << 8) |
        Math.min(255, b * shade);
    }
  }
  return tex;
}

export function loadTextures(textureDefs, width = 64, height = 64) {
  const textures = {};
  for (const key in textureDefs) {
    textures[key] = makeTexture(textureDefs[key], width, height);
  }
  return textures;
}
