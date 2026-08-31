import { Camera } from './core/camera.js';
import { castRay } from './core/dda.js';
import { wallProjection } from './core/projection.js';

export class Raycaster {
  constructor(project) {
    this.project = project;
    this.world = project.world;
    this.camera = new Camera(
      project.camera.posX,
      project.camera.posY,
      project.camera.dirX,
      project.camera.dirY,
      project.camera.planeX,
      project.camera.planeY,
    );
  }

  renderSimple(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const buf = img.data;
    const { map, colors, floorColor, ceilColor } = this.world;

    // suelo y techo de fondo (paso 1: sólidos)
    for (let y = 0; y < h; y++) {
      const color = y < h / 2 ? ceilColor : floorColor;
      const r = (color >> 16) & 255;
      const g = (color >> 8) & 255;
      const b = color & 255;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }

    const cam = this.camera;
    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rayDirX = cam.dirX + cam.planeX * cameraX;
      const rayDirY = cam.dirY + cam.planeY * cameraX;
      const hit = castRay(map, cam.posX, cam.posY, rayDirX, rayDirY);
      const { drawStart, drawEnd } = wallProjection(hit.perpWallDist, h);
      let color = colors[hit.tile];
      if (hit.side === 1) color = darken(color);
      const r = (color >> 16) & 255;
      const g = (color >> 8) & 255;
      const b = color & 255;
      for (let y = drawStart; y <= drawEnd; y++) {
        const i = (y * w + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }
    }

    ctx.putImageData(img, 0, 0);
  }
}

function darken(rgb) {
  const r = ((rgb >> 16) & 255) >> 1;
  const g = ((rgb >> 8) & 255) >> 1;
  const b = (rgb & 255) >> 1;
  return (r << 16) | (g << 8) | b;
}
