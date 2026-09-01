export function castFloorCeiling(map, camPosX, camPosY, camDirX, camDirY, camPlaneX, camPlaneY, screenWidth, screenHeight, floorTexNum, ceilTexNum, textures) {
  const floorTex = textures && textures[floorTexNum] ? textures[floorTexNum] : null;
  const ceilTex = textures && textures[ceilTexNum] ? textures[ceilTexNum] : null;
  const texWidth = 64;
  const texHeight = 64;

  // Altura del ojo del jugador (en unidades de mapa).
  const posZ = 1.0;

  const buffer = new Uint32Array(screenWidth * screenHeight);

  // Ray direction vectors for left and right edges
  const rayDirX0 = camDirX - camPlaneX;
  const rayDirY0 = camDirY - camPlaneY;
  const rayDirX1 = camDirX + camPlaneX;
  const rayDirY1 = camDirY + camPlaneY;

  // --- FLOOR ---
  for (let y = Math.floor(screenHeight / 2); y < screenHeight; ++y) {
    const p = y - screenHeight / 2;
    const rowDistance = (p !== 0) ? posZ / p : 0;

    const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / screenWidth;
    const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / screenWidth;

    let floorX = camPosX + rowDistance * rayDirX0;
    let floorY = camPosY + rowDistance * rayDirY0;

    for (let x = 0; x < screenWidth; ++x) {
      const cellX = Math.floor(floorX);
      const cellY = Math.floor(floorY);
      const isValid = cellY >= 0 && cellY < map.length && cellX >= 0 && cellX < map[0].length;

      let color = 0x202020; // default floor color

      if (isValid) {
        if (floorTex) {
          const texX = Math.floor((floorX - Math.floor(floorX)) * texWidth) & (texWidth - 1);
          const texY = Math.floor((floorY - Math.floor(floorY)) * texHeight) & (texHeight - 1);
          color = floorTex[texY * texWidth + texX];
        } else {
          color = 0x404040;
        }
      }

      buffer[x + y * screenWidth] = color;

      floorX += floorStepX;
      floorY += floorStepY;
    }
  }

  // --- CEILING ---
  for (let y = 0; y < Math.floor(screenHeight / 2); ++y) {
    const p = y - screenHeight / 2;
    const rowDistance = (p !== 0) ? posZ / p : 0;

    const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / screenWidth;
    const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / screenWidth;

    let floorX = camPosX + rowDistance * rayDirX0;
    let floorY = camPosY + rowDistance * rayDirY0;

    for (let x = 0; x < screenWidth; ++x) {
      const cellX = Math.floor(floorX);
      const cellY = Math.floor(floorY);
      const isValid = cellY >= 0 && cellY < map.length && cellX >= 0 && cellX < map[0].length;

      let color = 0x404040; // default ceiling color

      if (isValid) {
        if (ceilTex) {
          const texX = Math.floor((floorX - Math.floor(floorX)) * texWidth) & (texWidth - 1);
          const texY = Math.floor((floorY - Math.floor(floorY)) * texHeight) & (texHeight - 1);
          color = ceilTex[texY * texWidth + texX];
        } else {
          color = 0x202020;
        }
      }

      // Draw ceiling at the symmetric y position
      buffer[x + (screenHeight - y - 1) * screenWidth] = color;

      floorX += floorStepX;
      floorY += floorStepY;
    }
  }

  return buffer;
}
