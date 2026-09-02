import * as THREE from 'three';

function sectorVertices(world, sector) {
  const map = new Map(world.vertices.map((v) => [v.id, v]));
  return sector.vertexIds.map((id) => map.get(id)).filter(Boolean);
}

function getVertexHeightArray(sector, baseKey, index) {
  const arr = sector[baseKey];
  if (Array.isArray(arr) && index < arr.length) return arr[index];
  return null;
}

function vertexHeight(sector, ref, vertex, baseH, slopeKey, index) {
  // 1. Alturas por vértice (terreno irregular)
  const explicit = getVertexHeightArray(sector, 'floorH', index);
  if (explicit !== null) return explicit;

  // 2. Slope uniforme
  const slope = sector[slopeKey];
  if (!slope) return baseH;
  const angleRad = (slope.angle * Math.PI) / 180;
  const delta = slope.axis === 'x' ? vertex.x - ref.x : vertex.y - ref.y;
  return baseH + delta * Math.tan(angleRad);
}

function fanIndices(vertexCount) {
  const indices = [];
  for (let i = 1; i < vertexCount - 1; i++) {
    indices.push(0, i, i + 1);
  }
  return indices;
}

export function createSectorFloorGeometry(world, sector) {
  const vertices = sectorVertices(world, sector);
  const ref = vertices[0];
  const positions = [];
  const uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const h = vertexHeight(sector, ref, v, sector.floorH, 'floorSlope', i);
    positions.push(v.x, h, v.y);
    uvs.push(v.x, v.y);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(fanIndices(vertices.length));
  geo.computeVertexNormals();
  return geo;
}

export function createSectorCeilingGeometry(world, sector) {
  const vertices = sectorVertices(world, sector);
  const ref = vertices[0];
  const positions = [];
  const uvs = [];
  for (let i = 0; i < vertices.length; i++) {
    const v = vertices[i];
    const h = vertexHeight(sector, ref, v, sector.ceilH, 'ceilSlope', i);
    positions.push(v.x, h, v.y);
    uvs.push(v.x, v.y);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  // Invertir orden para que la normal apunte hacia abajo
  const indices = fanIndices(vertices.length);
  const reversed = [];
  for (let i = 0; i < indices.length; i += 3) {
    reversed.push(indices[i], indices[i + 2], indices[i + 1]);
  }
  geo.setIndex(reversed);
  geo.computeVertexNormals();
  return geo;
}

export function createWallGeometry(wall, world, sector) {
  const map = new Map(world.vertices.map((v) => [v.id, v]));
  const a = map.get(wall.a);
  const b = map.get(wall.b);
  if (!a || !b) return null;

  const vertices = sectorVertices(world, sector);
  const ref = vertices[0];

  // Para paredes usamos el índice del vértice en el sector si existe.
  const idxA = sector.vertexIds.indexOf(wall.a);
  const idxB = sector.vertexIds.indexOf(wall.b);

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
  geo.computeVertexNormals();
  return geo;
}
