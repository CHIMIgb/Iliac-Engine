export function validateProject(project) {
  const errors = [];
  const warnings = [];

  if (!project || typeof project !== 'object') return finish(errors, 'project.json inválido: debe ser un objeto');

  // Audio (F4.5): project.audio = [{ id, src, bus?, loop?, volume?, spatial?, variations?, layers? }]
  // y project.music = { id, intensity?, bpm? } opcional. Aditivo: sin audio todo sigue válido.
  const AUDIO_BUSES = ['music', 'sfx', 'ambience', 'voice'];
  if (project.audio != null) {
    if (!Array.isArray(project.audio)) {
      errors.push('"project.audio" debe ser un array de definiciones { id, src, bus?, loop?, volume?, spatial? }');
    } else {
      const seen = new Set();
      for (const a of project.audio) {
        if (!a || typeof a !== 'object') { errors.push('"project.audio" contiene una entrada que no es objeto'); continue; }
        if (typeof a.id !== 'string' || !a.id) errors.push('audio: cada definición requiere "id" (string)');
        else if (seen.has(a.id)) errors.push(`audio: id duplicado "${a.id}"`);
        else seen.add(a.id);
        if (typeof a.src !== 'string' || !a.src) errors.push(`audio "${a.id}": requiere "src" (ruta)`);
        if (a.bus != null && !AUDIO_BUSES.includes(a.bus)) errors.push(`audio "${a.id}": "bus" debe ser music|sfx|ambience|voice`);
        if (a.loop != null && typeof a.loop !== 'boolean') errors.push(`audio "${a.id}": "loop" debe ser booleano`);
        if (a.volume != null && !(typeof a.volume === 'number' && a.volume >= 0 && a.volume <= 1)) {
          errors.push(`audio "${a.id}": "volume" debe ser un número 0..1`);
        }
        if (a.spatial != null && typeof a.spatial !== 'object') errors.push(`audio "${a.id}": "spatial" debe ser objeto { x?, y?, z?, follow? }`);
        else if (a.spatial?.follow != null && typeof a.spatial.follow !== 'string') errors.push(`audio "${a.id}": "spatial.follow" debe ser un id de sprite`);
        if (a.variations != null && (!Array.isArray(a.variations) || a.variations.some((s) => typeof s !== 'string'))) {
          errors.push(`audio "${a.id}": "variations" debe ser un array de rutas`);
        }
        if (a.layers != null && (!Array.isArray(a.layers) || a.layers.some((s) => typeof s !== 'string'))) {
          errors.push(`audio "${a.id}": "layers" debe ser un array de rutas (stems)`);
        }
      }
    }
  }

  if (project.music != null) {
    if (typeof project.music !== 'object') {
      errors.push('"project.music" debe ser un objeto { id, intensity?, bpm? }');
    } else {
      if (typeof project.music.id !== 'string' || !project.music.id) errors.push('"project.music.id" requiere un id de audio válido');
      else if (Array.isArray(project.audio) && !project.audio.some((a) => a?.id === project.music.id)) {
        errors.push(`"project.music.id" referencia un audio inexistente "${project.music.id}"`);
      }
      if (project.music.intensity != null && ![0, 1, 2].includes(project.music.intensity)) {
        errors.push('"project.music.intensity" debe ser 0, 1 o 2');
      }
      if (project.music.bpm != null && !(typeof project.music.bpm === 'number' && project.music.bpm > 0)) {
        errors.push('"project.music.bpm" debe ser un número > 0');
      }
    }
  }

  const world = project.world;
  if (!world || typeof world !== 'object') return finish(errors, 'project.json inválido: falta "world"');

  // Cielo lejano opcional (horizonte estilo Daggerfall): { set 0–30, frame? 0–31, base? }.
  // `set` elige la carpeta SKY (horizonte); `frame` elige la franja del día.
  if (world.sky != null) {
    if (typeof world.sky !== 'object') {
      finish(errors, '"world.sky" debe ser un objeto { set, frame?, base? }');
    } else {
      const s = world.sky;
      if (!Number.isInteger(s.set) || s.set < 0 || s.set > 30) errors.push('"world.sky.set" debe ser un entero 0–30');
      if (s.frame != null && (!Number.isInteger(s.frame) || s.frame < 0 || s.frame > 31)) errors.push('"world.sky.frame" debe ser un entero 0–31');
      if (s.base != null && typeof s.base !== 'string') errors.push('"world.sky.base" debe ser una ruta');
    }
  }

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
