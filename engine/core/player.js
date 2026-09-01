export class Player {
  constructor(posX, posY, posZ, yaw = 0, pitch = 0) {
    this.posX = posX;
    this.posY = posY;
    this.posZ = posZ;
    this.yaw = yaw;
    this.pitch = pitch;
    this.eyeHeight = 0.5;
    this.stepHeight = 0.6;
    this.gravity = 9.0;
  }

  get forwardX() {
    return Math.cos(this.yaw);
  }

  get forwardY() {
    return Math.sin(this.yaw);
  }

  get rightX() {
    return Math.cos(this.yaw + Math.PI / 2);
  }

  get rightY() {
    return Math.sin(this.yaw + Math.PI / 2);
  }

  rotateYaw(delta) {
    this.yaw += delta;
  }

  rotatePitch(delta) {
    this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch + delta));
  }

  updateZ(sectorMap, sectors) {
    const mx = Math.floor(this.posX);
    const my = Math.floor(this.posY);
    if (my < 0 || my >= sectorMap.length || mx < 0 || mx >= sectorMap[0].length) return;
    const sectorId = sectorMap[my][mx];
    const sector = sectors[sectorId];
    if (!sector) return;
    const targetZ = sector.floorH + this.eyeHeight;

    if (this.posZ > targetZ) {
      this.posZ = Math.max(targetZ, this.posZ - this.gravity * 0.016);
    } else if (this.posZ < targetZ && targetZ - this.posZ <= this.stepHeight) {
      this.posZ = targetZ;
    }
  }

  move(map, dirX, dirY, speed, dt) {
    const radius = 0.2;
    const step = speed * dt;

    const tryX = this.posX + dirX * step;
    const tryY = this.posY + dirY * step;

    if (dirX !== 0 && !checkCollision(map, tryX + Math.sign(dirX) * radius, this.posY)) {
      this.posX = tryX;
    }
    if (dirY !== 0 && !checkCollision(map, this.posX, tryY + Math.sign(dirY) * radius)) {
      this.posY = tryY;
    }
  }
}

export function checkCollision(map, x, y) {
  const mapX = Math.floor(x);
  const mapY = Math.floor(y);
  if (mapY < 0 || mapY >= map.length || mapX < 0 || mapX >= map[0].length) return true;
  return map[mapY][mapX] > 0;
}
