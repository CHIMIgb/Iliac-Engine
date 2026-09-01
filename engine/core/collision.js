export function checkCollision(map, x, y) {
  const mapX = Math.floor(x);
  const mapY = Math.floor(y);
  if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[0].length) return true;
  return map[mapY][mapX] > 0;
}

export function getSectorAt(sectorMap, x, y) {
  const mx = Math.floor(x);
  const my = Math.floor(y);
  if (my < 0 || my >= sectorMap.length || mx < 0 || mx >= sectorMap[0].length) return 0;
  return sectorMap[my][mx];
}
