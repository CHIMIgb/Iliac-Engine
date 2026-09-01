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
}
