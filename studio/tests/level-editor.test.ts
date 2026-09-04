/**
 * level-editor.test.ts — Tests del Level Editor (documento + serializador)
 *
 * Cubre la lógica pura: operaciones de edición del LevelDocument, serialización
 * a/desde project.json v3 y validación reutilizando el motor. No toca Canvas ni
 * Three.js (esa capa se prueba manualmente en el navegador).
 */

import { describe, it, expect } from 'vitest';
import { createLevelDocument } from '../src/level-editor/LevelDocument.js';
import { toProjectJson, fromProjectJson, validate } from '../src/level-editor/LevelSerializer.js';
import { createDefaultProject } from '../src/level-editor/defaultProject.js';

/** Construye un documento mínimo con una habitación cuadrada. */
function makeRoomDocument() {
  const doc = createLevelDocument();
  const a = doc.addVertex(0, 0);
  const b = doc.addVertex(4, 0);
  const c = doc.addVertex(4, 4);
  const d = doc.addVertex(0, 4);
  const sectorId = doc.addSector([a, b, c, d], { floorH: 0, ceilH: 3 });
  return { doc, sectorId };
}

describe('LevelDocument — operaciones de edición', () => {
  it('crea un documento vacío con valores por defecto', () => {
    const doc = createLevelDocument();
    expect(doc.meta.schemaVersion).toBe(3);
    expect(doc.meta.renderMode).toBe('3d');
    expect(doc.world.vertices).toHaveLength(0);
    expect(doc.world.sectors).toHaveLength(0);
    expect(doc.world.walls).toHaveLength(0);
  });

  it('añade vértices y sectores y actualiza el mundo', () => {
    const { doc, sectorId } = makeRoomDocument();
    expect(doc.world.vertices).toHaveLength(4);
    expect(doc.world.sectors).toHaveLength(1);
    expect(doc.world.sectors[0]!.vertexIds).toHaveLength(4);
    expect(doc.world.sectors[0]!.floorH).toBe(0);
    expect(doc.world.sectors[0]!.ceilH).toBe(3);
    expect(sectorId).toContain('sector');
  });

  it('mueve un vértice', () => {
    const { doc } = makeRoomDocument();
    const vid = doc.world.vertices[0]!.id;
    doc.moveVertex(vid, 10, 20);
    expect(doc.world.vertices[0]!.x).toBe(10);
    expect(doc.world.vertices[0]!.y).toBe(20);
  });

  it('establece altura de piso y techo', () => {
    const { doc, sectorId } = makeRoomDocument();
    doc.setFloorHeight(sectorId, 0.5);
    doc.setCeilHeight(sectorId, 4.5);
    expect(doc.world.sectors[0]!.floorH).toBe(0.5);
    expect(doc.world.sectors[0]!.ceilH).toBe(4.5);
  });

  it('borra un sector y sus paredes asociadas', () => {
    const doc = createLevelDocument();
    // Sector A
    const a1 = doc.addVertex(0, 0), a2 = doc.addVertex(4, 0), a3 = doc.addVertex(4, 4), a4 = doc.addVertex(0, 4);
    const sectorA = doc.addSector([a1, a2, a3, a4]);
    // Sector B (conectado)
    const b1 = doc.addVertex(4, 4), b2 = doc.addVertex(8, 4), b3 = doc.addVertex(8, 8), b4 = doc.addVertex(4, 8);
    const sectorB = doc.addSector([b1, b2, b3, b4]);
    // Pared sólida en A + portal A<->B
    doc.addWall(a1, a2, sectorA);
    doc.addWall(a3, b1, sectorA, sectorB, true);

    expect(doc.world.walls).toHaveLength(2);
    doc.removeSector(sectorA);
    expect(doc.world.sectors).toHaveLength(1);
    // Deben quedar 0 paredes: una tenía sectorFront=sectorA, la otra sectorBack=sectorA.
    expect(doc.world.walls).toHaveLength(0);
  });
});

describe('LevelDocument — reutiliza geometría del motor (sectorAt)', () => {
  it('devuelve el sector bajo un punto', () => {
    const { doc } = makeRoomDocument();
    const sector = doc.sectorAt(2, 2);
    expect(sector).not.toBeNull();
    expect(sector!.id).toContain('sector');
  });

  it('devuelve null fuera del sector', () => {
    const { doc } = makeRoomDocument();
    expect(doc.sectorAt(50, 50)).toBeNull();
  });
});

describe('LevelSerializer — toProjectJson / fromProjectJson', () => {
  it('hace round-trip de un documento sin perder datos', () => {
    const { doc } = makeRoomDocument();
    doc.render.fov = 72;
    doc.world.sprites.push({ id: 'sp1', tex: 'lamp', pos: { x: 1, y: 1, z: 2 }, scale: 0.8, billboard: true });

    const json = toProjectJson(doc);
    expect(json.meta.schemaVersion).toBe(3);
    expect(json.world.vertices).toHaveLength(4);
    expect(json.render.fov).toBe(72);
    expect(json.world.sprites).toHaveLength(1);

    const restored = fromProjectJson(json);
    expect(restored.world.vertices).toHaveLength(4);
    expect(restored.world.sprites[0]!.pos.x).toBe(1);
    // El documento restaurado es un LevelDocument válido.
    expect(restored.addVertex(9, 9).length).toBeGreaterThan(0);
  });

  it('serializa la plantilla por defecto como project.json v3 válido', () => {
    const doc = fromProjectJson(createDefaultProject());
    const result = validate(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detecta un proyecto inválido (sector sin vértices)', () => {
    const doc = createLevelDocument();
    doc.addSector([], { floorH: 0, ceilH: 3 });
    const result = validate(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('valida un proyecto con solo texto vacío como inválido (sin vértices)', () => {
    const doc = createLevelDocument();
    const result = validate(doc);
    expect(result.valid).toBe(false);
  });
});

describe('defaultProject', () => {
  it('crea una plantilla con 2 habitaciones conectadas por portal', () => {
    const project = createDefaultProject();
    expect(project.world.sectors).toHaveLength(2);
    const portal = project.world.walls.find((w) => w.portal);
    expect(portal).toBeTruthy();
    expect(portal!.sectorBack).not.toBeNull();
  });
});