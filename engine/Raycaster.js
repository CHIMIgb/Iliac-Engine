import { Camera } from './core/camera.js';
import { castRay } from './core/dda.js';
import { wallProjection } from './core/projection.js';
import { loadTextures } from './core/textures.js';

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
    this.textures = loadTextures(project.world.textures);
    this.texWidth = 64;
    this.texHeight = 64;
  }

  render(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const buf = img.data;
    const { map, floorColor, ceilColor } = this.world;

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
    const { texWidth, texHeight, textures } = this;

    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rayDirX = cam.dirX + cam.planeX * cameraX;
      const rayDirY = cam.dirY + cam.planeY * cameraX;
      const hit = castRay(map, cam.posX, cam.posY, rayDirX, rayDirY);
      const { drawStart, drawEnd } = wallProjection(hit.perpWallDist, h);

      const tex = textures[hit.tile];
      let wallX;
      if (hit.side === 0) wallX = cam.posY + hit.perpWallDist * rayDirY;
      else wallX = cam.posX + hit.perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texWidth);
      if (hit.side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
      if (hit.side === 1 && rayDirY < 0) texX = texWidth - texX - 1;

      const step = (1.0 * texHeight) / (hit.perpWallDist > 0 ? (h / hit.perpWallDist) : 1);
      const lineHeight = Math.floor(h / hit.perpWallDist);
      let texPos = (drawStart - h / 2 + lineHeight / 2) * step;

      for (let y = drawStart; y <= drawEnd; y++) {
        let texY = Math.floor(texPos) & (texHeight - 1);
        texPos += step;
        let color = tex[texY * texWidth + texX];
        if (hit.side === 1) color = darken(color);
        const i = (y * w + x) * 4;
        buf[i] = (color >> 16) & 255;
        buf[i + 1] = (color >> 8) & 255;
        buf[i + 2] = color & 255;
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
