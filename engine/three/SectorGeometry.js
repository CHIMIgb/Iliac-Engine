import * as THREE from 'three';

function sectorVertices(world, sector, vertexMap) {
  const map = vertexMap || new Map(world.vertices.map((v) => [v.id, v]));
  return sector.vertexIds.map((id) => map.get(id)).filter(Boolean);
}

function vertexHeight(sector, ref, vertex, baseH, slopeKey, index) {
  if (Array.isArray(baseH) && index < baseH.length) return baseH[index];

  const slope = sector[slopeKey];
  if (!slope) return baseH;
  const angleRad = (slope.angle * Math.PI) / 180;
  const delta = slope.axis === 'x' ? vertex.x - ref.x : vertex.y - ref.y;
  return baseH + delta * Math.tan(angleRad);
}

function setFlatNormals(geo, nx, ny, nz) {
  const count = geo.attributes.position.count;
  const normals = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    normals[i * 3] = nx;
    normals[i * 3 + 1] = ny;
    normals[i * 3 + 2] = nz;
  }
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
}

function triangleNormal(positions, i0, i1, i2) {
  const ax = positions[i1 * 3] - positions[i0 * 3];
  const ay = positions[i1 * 3 + 1] - positions[i0 * 3 + 1];
  const az = positions[i1 * 3 + 2] - positions[i0 * 3 + 2];
  const bx = positions[i2 * 3] - positions[i0 * 3];
  const by = positions[i2 * 3 + 1] - positions[i0 * 3 + 1];
  const bz = positions[i2 * 3 + 2] - positions[i0 * 3 + 2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz);
  return len > 0 ? [nx / len, ny / len, nz / len] : null;
}

function getRepeat(repeatDef) {
  if (repeatDef === undefined || repeatDef === null) return { x: 1, y: 1 };
  if (typeof repeatDef === 'number') return { x: repeatDef, y: repeatDef };
  if (Array.isArray(repeatDef)) return { x: repeatDef[0] ?? 1, y: repeatDef[1] ?? 1 };
  if (typeof repeatDef === 'object') return { x: repeatDef.x ?? repeatDef.u ?? 1, y: repeatDef.y ?? repeatDef.v ?? 1 };
  return { x: 1, y: 1 };
}

export function createSectorFloorGeometry(world, sector, vertexMap, repeatDef) {
  const { x: rx, y: ry } = getRepeat(repeatDef);
  const vertices = sectorVertices(world, sector, vertexMap);
  const ref = vertices[0];
  const positions = [];
  const uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const h = vertexHeight(sector, ref, v, sector.floorH, 'floorSlope', i);
    positions.push(v.x, h, v.y);
    uvs.push(v.x * rx, v.y * ry);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  
  const contour = vertices.map(v => new THREE.Vector2(v.x, v.y));
  const indices = THREE.ShapeUtils.triangulateShape(contour, []);
  geo.setIndex(indices.flat());
  
  if (Array.isArray(sector.floorH)) {
    geo.computeVertexNormals();
  } else {
    const normal = triangleNormal(positions, 0, 1, 2);
    if (normal) setFlatNormals(geo, -normal[0], -normal[1], -normal[2]);
    else geo.computeVertexNormals();
  }
  return geo;
}

export function createSectorCeilingGeometry(world, sector, vertexMap, repeatDef) {
  const { x: rx, y: ry } = getRepeat(repeatDef);
  const vertices = sectorVertices(world, sector, vertexMap);
  const ref = vertices[0];
  const positions = [];
  const uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const h = vertexHeight(sector, ref, v, sector.ceilH, 'ceilSlope', i);
    positions.push(v.x, h, v.y);
    uvs.push(v.x * rx, v.y * ry);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  
  const contour = vertices.map(v => new THREE.Vector2(v.x, v.y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const indices = [];
  // Para el techo, invertimos el orden de los índices para que mire hacia abajo
  for (const [a, b, c] of tris) {
    indices.push(a, c, b);
  }
  geo.setIndex(indices);
  
  if (Array.isArray(sector.ceilH)) {
    geo.computeVertexNormals();
  } else {
    const normal = triangleNormal(positions, 0, 1, 2);
    if (normal) setFlatNormals(geo, normal[0], normal[1], normal[2]);
    else geo.computeVertexNormals();
  }
  return geo;
}

export function createWallGeometry(wall, world, sector, vertexMap, vertexIndexMap, repeatDef) {
  const { x: rx, y: ry } = getRepeat(repeatDef);
  const map = vertexMap || new Map(world.vertices.map((v) => [v.id, v]));
  const a = map.get(wall.a);
  const b = map.get(wall.b);
  if (!a || !b) return null;

  const vertices = sectorVertices(world, sector, vertexMap);
  const ref = vertices[0];

  const idxA = vertexIndexMap ? vertexIndexMap.get(wall.a) : sector.vertexIds.indexOf(wall.a);
  const idxB = vertexIndexMap ? vertexIndexMap.get(wall.b) : sector.vertexIds.indexOf(wall.b);

  const fa = vertexHeight(sector, ref, a, sector.floorH, 'floorSlope', idxA >= 0 ? idxA : 0);
  const fb = vertexHeight(sector, ref, b, sector.floorH, 'floorSlope', idxB >= 0 ? idxB : 0);
  const ca = vertexHeight(sector, ref, a, sector.ceilH, 'ceilSlope', idxA >= 0 ? idxA : 0);
  const cb = vertexHeight(sector, ref, b, sector.ceilH, 'ceilSlope', idxB >= 0 ? idxB : 0);

  const positions = [
    a.x, fa, a.y,
    b.x, fb, b.y,
    b.x, cb, b.y,
    a.x, ca, a.y,
  ];
  // UV: u along wall length (0..1), v along height (0..1)
  const uvs = [
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);

  // Apply repeat to UVs
  const uvAttr = geo.attributes.uv;
  for (let i = 0; i < uvAttr.count; i++) {
    uvAttr.setX(i, uvAttr.getX(i) * rx);
    uvAttr.setY(i, uvAttr.getY(i) * ry);
  }
  uvAttr.needsUpdate = true;

  const dx = b.x - a.x;
  const dz = b.y - a.y;
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    setFlatNormals(geo, -dz / len, 0, dx / len);
  } else {
    setFlatNormals(geo, 0, 0, 1);
  }
  return geo;
}