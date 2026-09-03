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

  const solidWalls = (world.walls || []).filter((w) => !(w.sectorBack && w.portal));
  const bvh = buildBVH(world);

  return { vertexMap, wallsBySector, solidWalls, bvh };
}

export function getSectorVertices(world, sector, vertexMap) {
  const map = vertexMap || buildSectorIndex(world).vertexMap;
  return sector.vertexIds.map((id) => map.get(id)).filter(Boolean);
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

export function getSectorAt(world, x, y, vertexMap) {
  const index = buildSectorIndex(world);
  return queryBVH(world, index.bvh, x, y, index.vertexMap);
}

function aabbIntersects(aabb, x, y) {
  return x >= aabb.minX && x <= aabb.maxX && y >= aabb.minY && y <= aabb.maxY;
}

function sectorAABB(world, sector) {
  const map = new Map(world.vertices.map((v) => [v.id, v]));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of sector.vertexIds) {
    const v = map.get(id);
    if (!v) continue;
    minX = Math.min(minX, v.x);
    minY = Math.min(minY, v.y);
    maxX = Math.max(maxX, v.x);
    maxY = Math.max(maxY, v.y);
  }
  return { minX, minY, maxX, maxY };
}

function buildBVH(world) {
  const leaves = world.sectors.map((sector) => {
    return { sector, aabb: sectorAABB(world, sector), isLeaf: true };
  });
  return buildBVHRecursive(leaves);
}

function buildBVHRecursive(nodes) {
  if (nodes.length === 1) {
    return { ...nodes[0], left: null, right: null };
  }
  if (nodes.length === 2) {
    return {
      aabb: mergeAABBs(nodes[0].aabb, nodes[1].aabb),
      left: { ...nodes[0], isLeaf: true },
      right: { ...nodes[1], isLeaf: true },
      isLeaf: false,
    };
  }
  const bbox = mergeAABBsArray(nodes);
  const axis = bbox.maxX - bbox.minX > bbox.maxY - bbox.minY ? 'x' : 'y';
  nodes.sort((a, b) => {
    if (axis === 'x') {
      return (a.aabb.minX + a.aabb.maxX) - (b.aabb.minX + b.aabb.maxX);
    }
    return (a.aabb.minY + a.aabb.maxY) - (b.aabb.minY + b.aabb.maxY);
  });
  const mid = Math.floor(nodes.length / 2);
  const left = buildBVHRecursive(nodes.slice(0, mid));
  const right = buildBVHRecursive(nodes.slice(mid));
  return { aabb: mergeAABBs(left.aabb, right.aabb), left, right, isLeaf: false };
}

function mergeAABBs(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

function mergeAABBsArray(nodes) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.aabb.minX);
    minY = Math.min(minY, n.aabb.minY);
    maxX = Math.max(maxX, n.aabb.maxX);
    maxY = Math.max(maxY, n.aabb.maxY);
  }
  return { minX, minY, maxX, maxY };
}

function queryBVH(world, node, x, y, vertexMap) {
  if (!node || !aabbIntersects(node.aabb, x, y)) return null;
  if (node.isLeaf) {
    return pointInSector(world, node.sector, x, y, vertexMap) ? node.sector : null;
  }
  return queryBVH(world, node.left, x, y, vertexMap) || queryBVH(world, node.right, x, y, vertexMap);
}

function barycentric(p, a, b, c) {
  const det = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(det) < 1e-12) return null;
  const w1 = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / det;
  const w2 = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / det;
  const w3 = 1 - w1 - w2;
  return { w1, w2, w3 };
}

function pointInTriangle(p, a, b, c) {
  const bc = barycentric(p, a, b, c);
  if (!bc) return false;
  return bc.w1 >= -1e-9 && bc.w2 >= -1e-9 && bc.w3 >= -1e-9;
}

function interpolateHeight(vertices, heights, x, y) {
  const p = { x, y };
  for (let i = 1; i < vertices.length - 1; i++) {
    const a = vertices[0];
    const b = vertices[i];
    const c = vertices[i + 1];
    if (pointInTriangle(p, a, b, c)) {
      const bc = barycentric(p, a, b, c);
      return bc.w1 * heights[0] + bc.w2 * heights[i] + bc.w3 * heights[i + 1];
    }
  }
  return null;
}

function vertexHeights(sector, vertices, baseH, slopeKey) {
  if (Array.isArray(baseH)) return baseH;

  const slope = sector[slopeKey];
  const ref = vertices[0];
  const out = [];
  for (const v of vertices) {
    if (!slope) {
      out.push(baseH);
    } else {
      const angleRad = (slope.angle * Math.PI) / 180;
      const delta = slope.axis === 'x' ? v.x - ref.x : v.y - ref.y;
      out.push(baseH + delta * Math.tan(angleRad));
    }
  }
  return out;
}

function heightAt(world, sector, x, y, baseH, slopeKey, vertexMap) {
  const vertices = getSectorVertices(world, sector, vertexMap);
  const heights = vertexHeights(sector, vertices, baseH, slopeKey);

  const interpolated = interpolateHeight(vertices, heights, x, y);
  if (interpolated !== null) return interpolated;

  const slope = sector[slopeKey];
  if (!slope) return baseH;
  const ref = vertices[0];
  const angleRad = (slope.angle * Math.PI) / 180;
  const delta = slope.axis === 'x' ? x - ref.x : y - ref.y;
  return baseH + delta * Math.tan(angleRad);
}

export function getFloorHeightAt(world, sector, x, y, vertexMap) {
  return heightAt(world, sector, x, y, sector.floorH, 'floorSlope', vertexMap);
}

export function getCeilHeightAt(world, sector, x, y, vertexMap) {
  return heightAt(world, sector, x, y, sector.ceilH, 'ceilSlope', vertexMap);
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

export function getSectorAtOrNearest(world, x, y, vertexMap) {
  const sector = getSectorAt(world, x, y, vertexMap);
  if (sector) return sector;

  let best = null;
  let bestDist = Infinity;
  for (const s of world.sectors) {
    const verts = getSectorVertices(world, s, vertexMap);
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
