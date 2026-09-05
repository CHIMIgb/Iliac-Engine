/**
 * EntityPreviewMesh — cubos/prismas que representan las entidades en el editor.
 *
 * Cada entidad del documento (sprite con collisionBox) se dibuja como un cubo
 * o prisma rectangular semitransparente con su caja de colisión real (w × d × h)
 * centrada en el suelo, coloreado por tipo: NPC azul, humano rojo, animal verde.
 *
 * Es SOLO del editor: el juego renderiza las entidades como billboard
 * (SpriteSystem del motor). Esta guía visual recuerda al diseñador el volumen
 * que ocupará cada entidad y su tipo de colisión.
 */

import * as THREE from 'three';
import type { EditableSprite } from '../editor/types';

// Materiales compartidos (se crean una vez; nunca se deshacen por entidad).
const MAT_NPC = new THREE.MeshBasicMaterial({ color: 0x89b4fa, transparent: true, opacity: 0.3, depthWrite: false });
const MAT_HUMAN = new THREE.MeshBasicMaterial({ color: 0xf38ba8, transparent: true, opacity: 0.3, depthWrite: false });
const MAT_ANIMAL = new THREE.MeshBasicMaterial({ color: 0xa6e3a1, transparent: true, opacity: 0.3, depthWrite: false });
const MAT_EDGE = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });

const _boxGeo = new THREE.BoxGeometry(1, 1, 1);
const _edgeGeo = new THREE.EdgesGeometry(_boxGeo);

function materialFor(collisionType: EditableSprite['collisionType']): THREE.Material {
  if (collisionType === 'human') return MAT_HUMAN;
  if (collisionType === 'animal') return MAT_ANIMAL;
  return MAT_NPC;
}

/** Construye el grupo de cajas de colisión para todas las entidades. */
export function buildEntityBoxes(sprites: EditableSprite[]): THREE.Group {
  const group = new THREE.Group();
  group.name = '__entity_boxes__';

  for (const sp of sprites) {
    const box = sp.collisionBox;
    if (!box) continue;

    // Coordenadas Three: x = doc.x, y = doc.z (altura), z = doc.y (profundidad).
    // La caja se centra verticalmente en su mitad de alto (base en el suelo).
    const cx = sp.pos.x;
    const cy = sp.pos.z + box.h / 2 + 0.02;
    const cz = sp.pos.y;

    const mesh = new THREE.Mesh(_boxGeo, materialFor(sp.collisionType));
    mesh.scale.set(box.w, box.h, box.d);
    mesh.position.set(cx, cy, cz);

    const edges = new THREE.LineSegments(_edgeGeo, MAT_EDGE);
    edges.scale.copy(mesh.scale);
    edges.position.copy(mesh.position);

    // Id en userData para identificación futura (picking de entidades).
    mesh.userData.spriteId = sp.id;
    edges.userData.spriteId = sp.id;

    group.add(mesh, edges);
  }
  return group;
}