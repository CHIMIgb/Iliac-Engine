import { checkCollision } from './collision.js';

export function moveWithCollision(player, map, dirX, dirY, speed, dt, radius = 0.2) {
  const step = speed * dt;

  const tryX = player.posX + dirX * step;
  const tryY = player.posY + dirY * step;

  if (dirX !== 0 && !checkCollision(map, tryX + Math.sign(dirX) * radius, player.posY)) {
    player.posX = tryX;
  }
  if (dirY !== 0 && !checkCollision(map, player.posX, tryY + Math.sign(dirY) * radius)) {
    player.posY = tryY;
  }
}

export function updateVertical(player, sectorMap, sectors) {
  const mx = Math.floor(player.posX);
  const my = Math.floor(player.posY);
  if (my < 0 || my >= sectorMap.length || mx < 0 || mx >= sectorMap[0].length) return;
  const sectorId = sectorMap[my][mx];
  const sector = sectors[sectorId];
  if (!sector) return;
  const targetZ = sector.floorH + player.eyeHeight;

  if (player.posZ > targetZ) {
    player.posZ = Math.max(targetZ, player.posZ - player.gravity * 0.016);
  } else if (player.posZ < targetZ && targetZ - player.posZ <= player.stepHeight) {
    player.posZ = targetZ;
  }
}
