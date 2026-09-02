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

// ---------- Física de sectores poligonales (schema v3) ----------

import { getSectorAtOrNearest, getSolidWalls, closestPointOnSegment, getFloorHeightAt } from './sector.js';

function resolveSectorCollisions(player, world, radius) {
  const sector = getSectorAtOrNearest(world, player.posX, player.posY);
  if (!sector) return;

  const walls = getSolidWalls(world, sector.id);
  for (let iter = 0; iter < 4; iter++) {
    let resolved = true;
    for (const { a, b } of walls) {
      const closest = closestPointOnSegment(player.posX, player.posY, a, b);
      const dx = player.posX - closest.x;
      const dy = player.posY - closest.y;
      const dist = Math.hypot(dx, dy);
      if (dist < radius && dist > 1e-9) {
        const push = (radius - dist) / dist;
        player.posX += dx * push;
        player.posY += dy * push;
        resolved = false;
      }
    }
    if (resolved) break;
  }
}

export function moveWithSectorCollision(player, world, dirX, dirY, speed, dt, radius = 0.2) {
  const distance = speed * dt;
  const maxSubStep = radius * 0.5;
  const steps = Math.max(1, Math.ceil(distance / maxSubStep));
  const len = Math.hypot(dirX, dirY) || 1;
  const subX = (dirX / len) * (distance / steps);
  const subY = (dirY / len) * (distance / steps);

  for (let i = 0; i < steps; i++) {
    player.posX += subX;
    resolveSectorCollisions(player, world, radius);
    player.posY += subY;
    resolveSectorCollisions(player, world, radius);
  }
}

export function updateVerticalSector(player, world, dt) {
  const sector = getSectorAtOrNearest(world, player.posX, player.posY);
  if (!sector) return;

  // Altura de suelo en el punto actual (soporta slopes).
  const floorH = getFloorHeightAt(world, sector, player.posX, player.posY);
  const targetZ = floorH + player.eyeHeight;

  if (player.posZ > targetZ) {
    player.posZ = Math.max(targetZ, player.posZ - player.gravity * dt);
  } else if (player.posZ < targetZ && targetZ - player.posZ <= player.stepHeight) {
    player.posZ = Math.min(targetZ, player.posZ + player.gravity * dt);
  }
}
