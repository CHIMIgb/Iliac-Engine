import * as THREE from 'three';

/**
 * Mergea un array de BufferGeometry indexadas en una sola geometría.
 *
 * Requisitos: todas las geometrías deben tener los mismos atributos
 * (al menos 'position' y 'uv'). Se asume que los índices son triángulos.
 *
 * @param {THREE.BufferGeometry[]} geometries
 * @returns {THREE.BufferGeometry | null}
 */
export function mergeGeometries(geometries) {
  if (!geometries || geometries.length === 0) return null;
  if (geometries.length === 1) return geometries[0];

  let vertexCount = 0;
  let indexCount = 0;
  for (const geo of geometries) {
    vertexCount += geo.attributes.position.count;
    indexCount += geo.index ? geo.index.count : 0;
  }

  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const indices = indexCount > 0 ? new Uint32Array(indexCount) : null;

  let posOffset = 0;
  let uvOffset = 0;
  let idxOffset = 0;
  let vertexOffset = 0;

  for (const geo of geometries) {
    const pos = geo.attributes.position.array;
    const uv = geo.attributes.uv.array;
    const geoIndices = geo.index ? geo.index.array : null;
    const geoVertexCount = geo.attributes.position.count;

    positions.set(pos, posOffset);
    uvs.set(uv, uvOffset);

    if (geoIndices && indices) {
      for (let i = 0; i < geoIndices.length; i++) {
        indices[idxOffset + i] = geoIndices[i] + vertexOffset;
      }
    }

    posOffset += pos.length;
    uvOffset += uv.length;
    if (geoIndices) idxOffset += geoIndices.length;
    vertexOffset += geoVertexCount;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  if (indices) merged.setIndex(new THREE.BufferAttribute(indices, 1));
  merged.computeVertexNormals();
  return merged;
}
