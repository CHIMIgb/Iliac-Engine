export class Camera {
  constructor(posX, posY, dirX, dirY, planeX, planeY) {
    this.posX = posX;
    this.posY = posY;
    this.dirX = dirX;
    this.dirY = dirY;
    this.planeX = planeX;
    this.planeY = planeY;
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
}
