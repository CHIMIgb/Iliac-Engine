export function buildSectorIndex(world) {
  const vertexMap = new Map();
  for (const v of world.vertices) {
    vertexMap.set(v.id, v);
  }

  const wallsBySector = new Map();
  for (const sector of world.sectors) {
    wallsBySector.set(sector.id, []);
  }
  for (const wall of world.walls) {
    const list = wallsBySector.get(wall.sectorFront) || [];
    list.push(wall);
    wallsBySector.set(wall.sectorFront, list);
  }

  return { vertexMap, wallsBySector };
}

export function getSectorVertices(world, sector, vertexMap) {
  const map = vertexMap || buildSectorIndex(world).vertexMap;
  return sector.vertexIds.map((id) => map.get(id));
}

export function pointInPolygon(polygon, x, y) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function pointInSector(world, sector, x, y, vertexMap) {
  const poly = getSectorVertices(world, sector, vertexMap);
  return pointInPolygon(poly, x, y);
}

export function getSectorAt(world, x, y) {
  const { vertexMap } = buildSectorIndex(world);
  for (const sector of world.sectors) {
    if (pointInSector(world, sector, x, y, vertexMap)) {
      return sector;
    }
  }
  return null;
}

function heightAt(sector, vertices, x, y, baseH, slopeKey) {
  const slope = sector[slopeKey];
  if (!slope) return baseH;

  const ref = vertices[0];
  const angleRad = (slope.angle * Math.PI) / 180;
  const delta = slope.axis === 'x' ? x - ref.x : y - ref.y;
  return baseH + delta * Math.tan(angleRad);
}

export function getFloorHeightAt(world, sector, x, y) {
  const vertices = getSectorVertices(world, sector);
  return heightAt(sector, vertices, x, y, sector.floorH, 'floorSlope');
}

export function getCeilHeightAt(world, sector, x, y) {
  const vertices = getSectorVertices(world, sector);
  return heightAt(sector, vertices, x, y, sector.ceilH, 'ceilSlope');
}

export function getSolidWalls(world, sectorId) {
  const { vertexMap, wallsBySector } = buildSectorIndex(world);
  const walls = wallsBySector.get(sectorId) || [];
  const segments = [];
  for (const wall of walls) {
    if (wall.sectorBack && wall.portal) continue;
    const a = vertexMap.get(wall.a);
    const b = vertexMap.get(wall.b);
    if (a && b) segments.push({ a, b, wall });
  }
  return segments;
}

export function closestPointOnSegment(px, py, a, b) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = px - a.x;
  const wy = py - a.y;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return { x: a.x, y: a.y };
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return { x: b.x, y: b.y };
  const t = c1 / c2;
  return { x: a.x + t * vx, y: a.y + t * vy };
}

export function distancePointToSegment(px, py, a, b) {
  const closest = closestPointOnSegment(px, py, a, b);
  return Math.hypot(px - closest.x, py - closest.y);
}

export function getSectorAtOrNearest(world, x, y) {
  const sector = getSectorAt(world, x, y);
  if (sector) return sector;

  let best = null;
  let bestDist = Infinity;
  for (const s of world.sectors) {
    const verts = getSectorVertices(world, s);
    if (!verts.length) continue;
    let cx = 0;
    let cy = 0;
    for (const v of verts) {
      cx += v.x;
      cy += v.y;
    }
    cx /= verts.length;
    cy /= verts.length;
    const d = Math.hypot(cx - x, cy - y);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}
