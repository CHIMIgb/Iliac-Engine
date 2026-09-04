export function validateProject(project) {
  const errors = [];
  const warnings = [];

  if (!project || typeof project !== 'object') return finish(errors, 'project.json inválido: debe ser un objeto');

  const world = project.world;
  if (!world || typeof world !== 'object') return finish(errors, 'project.json inválido: falta "world"');

  const vertexIds = new Set((world.vertices || []).map((v) => v.id));
  const sectorIds = new Set((world.sectors || []).map((s) => s.id));

  if (!Array.isArray(world.vertices)) {
    finish(errors, '"world.vertices" debe ser un array');
  } else {
    for (const v of world.vertices) {
      if (v.id == null) errors.push(`vértice sin "id" en posición ${JSON.stringify(v)}`);
      if (typeof v.x !== 'number' || typeof v.y !== 'number') {
        errors.push(`vértice "${v.id}" requiere "x" e "y" numéricos`);
      }
    }
  }

  if (!Array.isArray(world.sectors)) {
    finish(errors, '"world.sectors" debe ser un array');
  } else {
    for (const s of world.sectors) {
      if (s.id == null) errors.push('sector sin "id"');
      if (!Array.isArray(s.vertexIds) || s.vertexIds.length < 3) {
        errors.push(`sector "${s.id}" requiere "vertexIds" con al menos 3 vértices`);
      } else {
        for (const vid of s.vertexIds) {
          if (!vertexIds.has(vid)) errors.push(`sector "${s.id}" referencia vértice inexistente "${vid}"`);
        }
      }
      if (!Number.isFinite(s.floorH) && typeof s.floorH !== 'object') {
        warnings.push(`sector "${s.id}" sin "floorH" numérico (usará 0)`);
      }
    }
  }

  if (Array.isArray(world.walls)) {
    for (const w of world.walls) {
      if (w.a == null || w.b == null || w.sectorFront == null) {
        errors.push(`pared "${w.id || '(sin id)'}" requiere "a", "b" y "sectorFront"`);
      } else {
        if (!vertexIds.has(w.a)) errors.push(`pared "${w.id}" referencia vértice inexistente "${w.a}"`);
        if (!vertexIds.has(w.b)) errors.push(`pared "${w.id}" referencia vértice inexistente "${w.b}"`);
        if (!sectorIds.has(w.sectorFront)) errors.push(`pared "${w.id}" referencia sector inexistente "${w.sectorFront}"`);
        if (w.sectorBack && !sectorIds.has(w.sectorBack)) {
          errors.push(`pared "${w.id}" referencia sector inexistente "${w.sectorBack}"`);
        }
      }
    }
  } else {
    warnings.push('"world.walls" ausente; no habrá colisión de paredes');
  }

  return { valid: errors.length === 0, errors, warnings };
}

function finish(errors, msg) {
  if (!errors.includes(msg)) errors.push(msg);
  return { valid: errors.length === 0, errors, warnings: [] };
}
