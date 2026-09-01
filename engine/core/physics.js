import { checkCollision } from './collision.js';

export function moveWithCollision(player, map, dirX, dirY, speed, dt, radius = 0.2) {
  const distance = speed * dt;
  const maxSubStep = 0.3;
  const steps = Math.max(1, Math.ceil(distance / maxSubStep));
  const subStep = distance / steps;

  for (let i = 0; i < steps; i++) {
    if (dirX !== 0) {
      const nextX = player.posX + dirX * subStep;
      if (!checkCollision(map, nextX + Math.sign(dirX) * radius, player.posY)) {
        player.posX = nextX;
      }
    }
    if (dirY !== 0) {
      const nextY = player.posY + dirY * subStep;
      if (!checkCollision(map, player.posX, nextY + Math.sign(dirY) * radius)) {
        player.posY = nextY;
      }
    }
  }
}

export function updateVertical(player, sectorMap, sectors, dt) {
  const mx = Math.floor(player.posX);
  const my = Math.floor(player.posY);
  if (my < 0 || my >= sectorMap.length || mx < 0 || mx >= sectorMap[0].length) return;
  const sectorId = sectorMap[my][mx];
  const sector = sectors[sectorId];
  if (!sector) return;
  const targetZ = sector.floorH + player.eyeHeight;
  const climbSpeed = 2.5;

  if (player.posZ > targetZ) {
    player.posZ = Math.max(targetZ, player.posZ - player.gravity * dt);
  } else if (player.posZ < targetZ && targetZ - player.posZ <= player.stepHeight) {
    player.posZ = Math.min(targetZ, player.posZ + climbSpeed * dt);
  }
}
