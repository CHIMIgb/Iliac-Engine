/**
 * sample-project.ts — Proyecto inicial del Studio.
 *
 * Arranca con un escenario de demostración listo para el playtest:
 * terreno de 64×64 m (celdas de 2 m) con relieve realista determinista
 * (elevaciones y hundimientos por ruido FBM del motor) y horizonte
 * Daggerfall SKY15. Sin guardar nada: `npm run dev` y ▶ directamente.
 */
import { EditorState } from './editor/EditorState';
import { placeTerrainAt, applyTerrainRelief } from './tools/tools';
import { toProjectJson } from './io/Serializer';

function buildDefaultDoc(): EditorState {
  const doc = new EditorState();
  doc.camera = { posX: 32, posY: 32, posZ: 6, yaw: 0, pitch: 0 }; // en el centro del terreno
  // Look retro del playtest: buffer Daggerfall 320×200 + CRT (tecla 9 cambia).
  doc.render = { ...doc.render, crt: true, resolution: [320, 200] };
  placeTerrainAt(doc, 0, 0, 64, 'grass', 2); // 32×32 = 1024 sectores
  applyTerrainRelief(doc, { seed: 1337, scale: 0.045, amplitude: 7 });
  doc.setSky({ set: 15 }); // horizonte Daggerfall (requiere npm run setup:sky)
  return doc;
}

export const sampleProject = toProjectJson(buildDefaultDoc());
