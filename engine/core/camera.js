import { checkCollision } from './dda.js';

export class Camera {
  constructor(posX, posY, dirX, dirY, planeX, planeY) {
    this.posX = posX;
    this.posY = posY;
    this.dirX = dirX;
    this.dirY = dirY;
    this.planeX = planeX;
    this.planeY = planeY;
    // Verticalidad (F2): altura del ojo, step height y gravedad.
    // Si no se proveen, se usa el valor por defecto de F1 (0.5).
    this.posZ = 0.5;
    this.stepHeight = 0.6;
    this.gravity = 9.0;
  }

  rotate(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const oldDirX = this.dirX;
    const oldPlaneX = this.planeX;
    this.dirX = this.dirX * cos - this.dirY * sin;
    this.dirY = oldDirX * sin + this.dirY * cos;
    this.planeX = this.planeX * cos - this.planeY * sin;
    this.planeY = oldPlaneX * sin + this.planeY * cos;
  }

  updateZ(sectorMap, sectors) {
    // Determina el sector actual y ajusta posZ hacia floorH del sector.
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

  move(map, forward, speed, dt) {
    const moveX = this.dirX * speed * dt * (forward ? 1 : -1);
    const moveY = this.dirY * speed * dt * (forward ? 1 : -1);

    if (!checkCollision(map, this.posX + moveX, this.posY)) this.posX += moveX;
    if (!checkCollision(map, this.posX, this.posY + moveY)) this.posY += moveY;
  }
}
