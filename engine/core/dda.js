export function castRay(map, posX, posY, dirX, dirY) {
  const mapX0 = Math.floor(posX);
  const mapY0 = Math.floor(posY);

  const deltaDistX = Math.abs(1 / dirX);
  const deltaDistY = Math.abs(1 / dirY);

  let stepX;
  let stepY;
  let sideDistX;
  let sideDistY;

  if (dirX < 0) {
    stepX = -1;
    sideDistX = (posX - mapX0) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX0 + 1 - posX) * deltaDistX;
  }
  if (dirY < 0) {
    stepY = -1;
    sideDistY = (posY - mapY0) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY0 + 1 - posY) * deltaDistY;
  }

  let mapX = mapX0;
  let mapY = mapY0;
  let side = 0;

  for (;;) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }
    const tile = map[mapY][mapX];
    if (tile > 0) {
      const perpWallDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      return { tile, side, perpWallDist, mapX, mapY };
    }
  }
}

export function checkCollision(map, x, y) {
  const mapX = Math.floor(x);
  const mapY = Math.floor(y);
  if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[0].length) return true;
  return map[mapY][mapX] > 0;
}
