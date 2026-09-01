import { Camera } from './core/camera.js';
import { castRay } from './core/dda.js';
import { wallProjection } from './core/projection.js';
import { loadTextures } from './core/textures.js';
import { drawFloorCeilingColumn } from './core/floorcasting.js';

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
    this.texWidth = 64;
    this.texHeight = 64;
    this.loaded = false;
    this.zbuffer = [];
  }

  async load() {
    this.textures = await loadTextures(this.project.world.textures, this.texWidth, this.texHeight);
    this.loaded = true;
    return this;
  }

  render(canvas) {
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.imageSmoothingEnabled = false;
    const w = canvas.width;
    const h = canvas.height;
    const img = ctx.createImageData(w, h);
    const buf = img.data;
    const { map, floorTextures, ceilTexNum } = this.world;

    if (!this.zbuffer || this.zbuffer.length !== w) this.zbuffer = new Array(w);

    const cam = this.camera;
    const { texWidth, texHeight, textures } = this;

    // Fondo por defecto (techo arriba, suelo abajo)
    for (let y = 0; y < h; y++) {
      const color = y < h / 2 ? 0x404040 : 0x202020;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[i] = (color >> 16) & 255;
        buf[i + 1] = (color >> 8) & 255;
        buf[i + 2] = color & 255;
        buf[i + 3] = 255;
      }
    }

    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rayDirX = cam.dirX + cam.planeX * cameraX;
      const rayDirY = cam.dirY + cam.planeY * cameraX;
      const hit = castRay(map, cam.posX, cam.posY, rayDirX, rayDirY);
      const { drawStart, drawEnd } = wallProjection(hit.perpWallDist, h);

      this.zbuffer[x] = hit.perpWallDist;

      const tex = textures[hit.tile];
      let wallX;
      if (hit.side === 0) wallX = cam.posY + hit.perpWallDist * rayDirY;
      else wallX = cam.posX + hit.perpWallDist * rayDirX;
      wallX -= Math.floor(wallX);

      let texX = Math.floor(wallX * texWidth);
      if (hit.side === 0 && rayDirX > 0) texX = texWidth - texX - 1;
      if (hit.side === 1 && rayDirY < 0) texX = texWidth - texX - 1;
      texX = Math.max(0, Math.min(texX, texWidth - 1));

      const step = (1.0 * texHeight) / (hit.perpWallDist > 0 ? (h / hit.perpWallDist) : 1);
      const lineHeight = Math.floor(h / hit.perpWallDist);
      let texPos = (drawStart - h / 2 + lineHeight / 2) * step;

      for (let y = drawStart; y <= drawEnd; y++) {
        let texY = Math.floor(texPos) & (texHeight - 1);
        texPos += step;
        const texPosBytes = (texY * texWidth + texX) * 4;
        let r = tex.data[texPosBytes];
        let g = tex.data[texPosBytes + 1];
        let b = tex.data[texPosBytes + 2];
        if (hit.side === 1) {
          r >>= 1;
          g >>= 1;
          b >>= 1;
        }
        const i = (y * w + x) * 4;
        buf[i] = r;
        buf[i + 1] = g;
        buf[i + 2] = b;
        buf[i + 3] = 255;
      }

      // --- SUELO Y TECHO (versión vertical de Lode) ---
      drawFloorCeilingColumn({
        buf,
        screenWidth: w,
        screenHeight: h,
        posX: cam.posX,
        posY: cam.posY,
        side: hit.side,
        mapX: hit.mapX,
        mapY: hit.mapY,
        wallX,
        rayDirX,
        rayDirY,
        perpWallDist: hit.perpWallDist,
        drawEnd,
        floorTextures,
        ceilTexNum,
        textures,
        texWidth,
        texHeight,
        x,
      });
    }

    ctx.putImageData(img, 0, 0);
  }
}
