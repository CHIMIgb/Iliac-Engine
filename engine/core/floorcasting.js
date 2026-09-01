export function drawFloorCeilingColumn({
  buf,
  screenWidth,
  screenHeight,
  posX,
  posY,
  side,
  mapX,
  mapY,
  wallX,
  rayDirX,
  rayDirY,
  perpWallDist,
  drawEnd,
  floorTextures,
  ceilTexNum,
  textures,
  texWidth,
  texHeight,
  x,
}) {
  // Coordenadas del suelo justo al pie de la pared (versión vertical de Lode)
  let floorXWall;
  let floorYWall;

  if (side === 0 && rayDirX > 0) {
    floorXWall = mapX;
    floorYWall = mapY + wallX;
  } else if (side === 0 && rayDirX < 0) {
    floorXWall = mapX + 1.0;
    floorYWall = mapY + wallX;
  } else if (side === 1 && rayDirY > 0) {
    floorXWall = mapX + wallX;
    floorYWall = mapY;
  } else {
    floorXWall = mapX + wallX;
    floorYWall = mapY + 1.0;
  }

  const distWall = perpWallDist;
  const distPlayer = 0.0;

  // Dibujar desde la base de la pared hasta el borde inferior de la pantalla
  const startY = drawEnd + 1;
  const safeDrawEnd = drawEnd < 0 ? screenHeight : drawEnd;

  for (let y = safeDrawEnd + 1; y < screenHeight; y++) {
    const currentDist = screenHeight / (2.0 * y - screenHeight);
    const weight = (currentDist - distPlayer) / (distWall - distPlayer);

    const currentFloorX = weight * floorXWall + (1.0 - weight) * posX;
    const currentFloorY = weight * floorYWall + (1.0 - weight) * posY;

    // Coordenadas de textura (texturas 4x más grandes, como en Lode)
    const floorTexX = Math.floor(currentFloorX * texWidth / 4) & (texWidth - 1);
    const floorTexY = Math.floor(currentFloorY * texHeight / 4) & (texHeight - 1);

    // Patrón de ajedrez para alternar texturas del suelo
    const checkerBoardPattern = (Math.floor(currentFloorX) + Math.floor(currentFloorY)) & 1;
    const floorTexIdx = floorTextures[checkerBoardPattern % floorTextures.length];
    const ceilTexIdx = ceilTexNum;

    const floorTex = textures[floorTexIdx];
    const ceilTex = textures[ceilTexIdx];

    const texPos = (floorTexY * texWidth + floorTexX) * 4;

    // --- PISO ---
    const floorBufPos = (y * screenWidth + x) * 4;
    if (floorTex && floorTex.data) {
      // Imagen real: Uint8ClampedArray [R,G,B,A,...]
      buf[floorBufPos] = floorTex.data[texPos] >> 1;
      buf[floorBufPos + 1] = floorTex.data[texPos + 1] >> 1;
      buf[floorBufPos + 2] = floorTex.data[texPos + 2] >> 1;
    } else if (floorTex) {
      // Textura procedural: Uint32Array de colores 0xRRGGBB
      const c = floorTex[floorTexY * texWidth + floorTexX];
      buf[floorBufPos] = ((c >> 16) & 255) >> 1;
      buf[floorBufPos + 1] = ((c >> 8) & 255) >> 1;
      buf[floorBufPos + 2] = (c & 255) >> 1;
    } else {
      buf[floorBufPos] = 0x20;
      buf[floorBufPos + 1] = 0x20;
      buf[floorBufPos + 2] = 0x20;
    }
    buf[floorBufPos + 3] = 255;

    // --- TECHO (simétrico) ---
    const ceilY = screenHeight - y - 1;
    if (ceilY >= 0) {
      const ceilBufPos = (ceilY * screenWidth + x) * 4;
      if (ceilTex && ceilTex.data) {
        buf[ceilBufPos] = ceilTex.data[texPos] >> 1;
        buf[ceilBufPos + 1] = ceilTex.data[texPos + 1] >> 1;
        buf[ceilBufPos + 2] = ceilTex.data[texPos + 2] >> 1;
      } else if (ceilTex) {
        const c = ceilTex[floorTexY * texWidth + floorTexX];
        buf[ceilBufPos] = ((c >> 16) & 255) >> 1;
        buf[ceilBufPos + 1] = ((c >> 8) & 255) >> 1;
        buf[ceilBufPos + 2] = (c & 255) >> 1;
      } else {
        buf[ceilBufPos] = 0x40;
        buf[ceilBufPos + 1] = 0x40;
        buf[ceilBufPos + 2] = 0x40;
      }
      buf[ceilBufPos + 3] = 255;
    }
  }
}
