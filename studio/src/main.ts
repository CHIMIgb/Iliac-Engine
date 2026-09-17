/**
 * RayCast Studio — Entry point.
 * Monta el layout, gestiona el EditorState, conecta persistencia
 * y herramientas de edición con el viewport 3D.
 */

import './style.css';
import { AppLayout } from './layout/AppLayout';
import { showToast } from './ui/Toast';
import { Icon } from './ui/Icon';
import { EditorViewport } from './viewport/EditorViewport';
import { EditorState } from './editor/EditorState';
import { ToolManager, type ToolId, type Selection } from './tools/ToolManager';
import { DungeonBrowser } from './ui/DungeonBrowser';
import { SpriteToolUI } from './spriteTool/spriteToolUI';
import { DUNGEONS } from './dungeons/definitions';
import { assemble, mergeDungeon } from './dungeons/assemble';
import { findSpot } from './dungeons/placement';
import { sampleProject } from './sample-project';
import { fromProjectJson, validateProjectJson } from './io/Serializer';
import { exportJson, importJson } from './io/FileManager';
import { AuthModal } from './ui/AuthModal';
import { getSession, setSession, clearSession, isAuthenticated } from './io/session';
import { ApiError } from './io/api';
import { createCloudProject, loadCloudMostRecent, saveCloudProject } from './io/CloudProject';
import { listAudioUrls, uploadAudioFiles, uploadSpriteFrames } from './io/assetApi';

// ── Layout ─────────────────────────────────────────────────────
const app = document.getElementById('app');
if (!app) throw new Error('#app no encontrado');
const layout = new AppLayout();
layout.mount(app);

// ── Estado editable ────────────────────────────────────────────
// C5c: sin persistencia local (guardar exige sesión → API). El documento de
// partida sigue siendo el del código hasta C5d (plantilla de la API).
const doc: EditorState = fromProjectJson(sampleProject as unknown as Record<string, unknown>);

// ── C5b/C5c: la fuente de verdad es la API (sesión obligatoria) ─
// Con sesión: el proyecto vive en la API → se abre el último de la cuenta
// (updatedAt desc) o se crea uno con el documento actual. Guardar (proyecto,
// exportar, importar, sprites, audio) exige sesión (decisión C5c): sin ella se
// avisa y se abre el modal de Cuenta; ya no hay guardado local.
let cloudProjectId: string | null = null;

/** Errores de API: 401 → sesión expirada (logout); resto → toast. */
function handleApiFailure(e: unknown, accion: string): void {
  if (e instanceof ApiError && e.code === 'UNAUTHORIZED') {
    clearSession();
    updateAccountButton();
    showToast('Sesión expirada — inicia sesión de nuevo', 'warning');
    return;
  }
  showToast(
    e instanceof Error ? `No se pudo ${accion}: ${e.message}` : `No se pudo ${accion}`,
    'error',
  );
}

/** Abre el último proyecto de la nube; si la cuenta está vacía sube el actual. */
async function initCloudProject(): Promise<void> {
  try {
    const recent = await loadCloudMostRecent();
    if (recent) {
      if (recent.projectId !== cloudProjectId) {
        Object.assign(doc, recent.state);
        viewport.reload(toRawProject(doc));
        nameLabel.textContent = doc.meta.name;
      }
      cloudProjectId = recent.projectId;
      showToast(`Proyecto «${doc.meta.name}» cargado de la nube`, 'success');
    } else {
      cloudProjectId = await createCloudProject(doc);
      showToast('Proyecto creado en la nube', 'success');
    }
  } catch (e) {
    handleApiFailure(e, 'cargar el proyecto');
  }
}

/**
 * Guarda el proyecto en la API. La sesión es obligatoria (C5c): sin ella se
 * avisa y se abre el modal de Cuenta, y el guardado se aborta.
 */
async function saveCurrent(): Promise<void> {
  if (!requireSession('guardar el proyecto')) return;
  try {
    if (!cloudProjectId) cloudProjectId = await createCloudProject(doc);
    else await saveCloudProject(doc, cloudProjectId);
    showToast('Proyecto guardado en la nube', 'success');
  } catch (e) {
    handleApiFailure(e, 'guardar');
  }
}

if (isAuthenticated()) void initCloudProject();

// ── Herramientas (ToolManager) ─────────────────────────────────
function showToolNotice(msg: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
  showToast(msg, type);
}

function showSelection(sel: Selection[]): void {
  const label =
    sel.length === 0 ? '—' :
    sel.length === 1 ? `${sel[0]!.kind} ${sel[0]!.id}` :
    `${sel.length} objetos`;
  layout.statusBar.setItem('sel', `Selección: ${label}`);
}

const toolManager = new ToolManager(doc, {
  onNotice: showToolNotice,
  onSelectionChange: showSelection,
  onToolChange: (tool) => layout.statusBar.setItem('tool', `Herramienta: ${tool}`),
  onStatus: (text) => layout.statusBar.setItem('terrain', text),
  // C5c: el popover de Audio sube/lista sus audios por la API (guardar exige sesión).
  audioAssets: {
    requireSession: (accion) => requireSession(accion),
    upload: (files) => uploadAudioFiles(files, cloudProjectId),
    listUrls: () => (isAuthenticated() ? listAudioUrls() : Promise.resolve(null)),
  },
});

// ── Viewport 3D ────────────────────────────────────────────────
const viewport = new EditorViewport();
viewport.toolManager = toolManager;
layout.viewport.appendChild(viewport.el);

viewport.init(toRawProject(doc) as never).catch((err) => {
  console.error('Error inicializando el viewport:', err);
  showToast(`Error al iniciar el motor: ${err}`, 'error');
});

// ── Toolbar: herramientas ──────────────────────────────────────
const toolGroup = layout.toolbar.addGroup();
const toolActions: { icon: string; label: string; key: string; id: ToolId }[] = [
  { icon: 'cursor',         label: 'Seleccionar',  key: '1', id: 'select' },
  { icon: 'box',            label: 'Vértices',     key: '2', id: 'vertex' },
  { icon: 'move',           label: 'Mover',        key: '3', id: 'move' },
  { icon: 'layers',         label: 'Paredes',       key: '4', id: 'wall' },
  { icon: 'ruler',          label: 'Alturas',       key: '5', id: 'height' },
  { icon: 'person-standing',label: 'Entidades',    key: '6', id: 'entity' },
  { icon: 'mountain',       label: 'Terreno',     key: '7', id: 'terrain' },
];

let activeToolId: ToolId = 'select';

function setActiveTool(id: ToolId): void {
  activeToolId = id;
  toolManager.setTool(id);
  layout.statusBar.setItem('tool', `Herramienta: ${id}`);
  toolActions.forEach((action, i) => layout.toolbar.setActive(i, action.id === id));
  skyBtn.classList.remove('active'); // elegir una herramienta quita los badges de Cielo/Audio/Sprites
  audioBtn.classList.remove('active');
  spriteBtn.classList.remove('active');
}

toolActions.forEach((action) => {
  const btn = layout.toolbar.addAction({
    icon: action.icon,
    label: action.label,
    shortcut: action.key,
    active: action.id === activeToolId,
    onClick: () => {
      setActiveTool(action.id);
      // El selector de entidades cuelga del icono Entidades (debajo de él).
      if (action.id === 'entity') {
        const r = btn.getBoundingClientRect();
        toolManager.openEntityPicker(r.left, r.bottom);
      }
      // El selector de tamaño cuelga del icono Terreno.
      if (action.id === 'terrain') {
        const r = btn.getBoundingClientRect();
        toolManager.openTerrainSizePicker(r.left, r.bottom);
      }
    },
  });
  toolGroup.appendChild(btn);
});

// ── Toolbar: cielo (horizonte Daggerfall) ──────────────────────
const skyBtn = layout.toolbar.addAction({
  icon: 'cloud', label: 'Cielo', shortcut: '8',
  onClick: () => {
    markSkyActive();
    const r = skyBtn.getBoundingClientRect();
    toolManager.openSkyPicker(r.left, r.bottom);
  },
});
toolGroup.appendChild(skyBtn);

// ── Toolbar: audio (F4.6.a — MVP: bucles de ambiente) ──────────
const audioBtn = layout.toolbar.addAction({
  icon: 'volume-2', label: 'Audio', shortcut: '9',
  onClick: () => {
    markAudioActive();
    const r = audioBtn.getBoundingClientRect();
    toolManager.openAudioPicker(r.left, r.bottom);
  },
});
toolGroup.appendChild(audioBtn);

// ── Toolbar: sprites (F5 — Sprite Tool: slicer + animator) ─────
const spriteTool = new SpriteToolUI();

// Wiring del guardado (F5 Fase B + C5c): sube cada frame a la API de assets
// (sesión obligatoria) y fusiona texturas + animaciones en el documento; las
// texturas apuntan a `/api/assets/<id>/file` (público, el motor las carga sin
// sesión).
spriteTool.onSaveRequested = async (out, frameDataUrls) => {
  if (!requireSession('guardar los sprites')) return;
  try {
    const results = await uploadSpriteFrames(frameDataUrls, cloudProjectId);
    const uploaded = Object.values(results).filter((r) => r.url);
    const failed = Object.values(results).filter((r) => !r.url);
    if (uploaded.length === 0) {
      showToast('No se pudo subir ningún frame a la API', 'error');
      return;
    }
    const urls: Record<string, string> = {};
    for (const r of uploaded) urls[r.key] = r.url!;
    doc.setWorldTextures(urls);
    doc.setSpriteAnims(out.spriteAnims);
    const reused = uploaded.filter((r) => r.reused).length;
    showToast(
      `Guardado: ${uploaded.length} frames${reused ? ` (${reused} ya existían)` : ''} + ` +
        `${Object.keys(out.spriteAnims).length} animaciones`,
      'success',
    );
    if (failed.length > 0) {
      showToast(`No se subieron ${failed.length} frames: ${failed[0]!.error}`, 'warning');
    }
  } catch (err) {
    console.error('Error guardando sprites:', err);
    handleApiFailure(err, 'guardar los sprites');
  }
};

// Puente F5→6.4: asignar la animación activa a un sprite del mundo.
spriteTool.onAssignSprite = (spriteId, anim) => {
  if (!doc.assignSpriteAnim(spriteId, anim)) {
    showToast('Sprite no encontrado', 'error');
    return;
  }
  showToast(`Sprite ${spriteId} → anim «${anim}»`, 'success');
};

const spriteBtn = layout.toolbar.addAction({
  icon: 'images', label: 'Sprites' /*, shortcut: '0' */,
  onClick: () => {
    markSpritesActive();
    spriteTool.setWorldSprites(
      doc.world.sprites.map((s) => ({ id: s.id, label: `${s.id} (${s.tex})` })),
    );
    spriteTool.onProjectSnapshot = () => doc.getSpriteLibrarySnapshot();
    spriteTool.open();
  },
});
toolGroup.appendChild(spriteBtn);

/** Cielo, Audio y Sprites se quitan mutuamente el badge azul al seleccionarse. */
function markSkyActive(): void {
  toolActions.forEach((_, i) => layout.toolbar.setActive(i, false));
  audioBtn.classList.remove('active');
  spriteBtn.classList.remove('active');
  skyBtn.classList.add('active');
}

/** El Audio luce el mismo badge que las herramientas al seleccionarlo. */
function markAudioActive(): void {
  toolActions.forEach((_, i) => layout.toolbar.setActive(i, false));
  skyBtn.classList.remove('active');
  spriteBtn.classList.remove('active');
  audioBtn.classList.add('active');
}

/** El Sprite Tool luce el mismo badge que Cielo/Audio al abrir el modal. */
function markSpritesActive(): void {
  toolActions.forEach((_, i) => layout.toolbar.setActive(i, false));
  skyBtn.classList.remove('active');
  audioBtn.classList.remove('active');
  spriteBtn.classList.add('active');
}

// ── Toolbar: mazmorras (junto a Entidades) ─────────────────────
const dungeonGroup = layout.toolbar.addGroup();
const dungeonBrowser = new DungeonBrowser();
dungeonGroup.appendChild(layout.toolbar.addAction({
  icon: 'map', label: 'Mazmorras',
  onClick: () => dungeonBrowser.open(DUNGEONS, (def) => {
    const dun = assemble(def);
    const spot = findSpot(doc, dun);
    if (!spot) {
      showToast('No hay espacio libre en la cuadrícula para la mazmorra', 'warning');
      return;
    }
    mergeDungeon(doc, dun, spot.x, spot.y);
    showToast(`${def.name} añadida en (${spot.x}, ${spot.y})`, 'success');
  }),
}));

layout.toolbar.addSeparator();

// ── Toolbar: archivo ───────────────────────────────────────────
const fileGroup = layout.toolbar.addGroup();

fileGroup.appendChild(layout.toolbar.addAction({
  icon: 'save', label: 'Guardar', shortcut: 'Ctrl+S',
  onClick: () => void saveCurrent(),
}));

fileGroup.appendChild(layout.toolbar.addAction({
  icon: 'download', label: 'Exportar JSON', shortcut: 'Ctrl+Shift+S',
  onClick: () => void exportCurrent(),
}));

/** Exporta el proyecto a un `.json` (requiere sesión, como todo guardado). */
async function exportCurrent(): Promise<void> {
  if (!requireSession('exportar el proyecto')) return;
  exportJson(doc);
  showToast('Proyecto exportado', 'success');
}

/** Importa un project.json y lo persiste en la nube (requiere sesión). */
async function importCurrent(): Promise<void> {
  if (!requireSession('importar un proyecto')) return;
  const result = await importJson();
  if (!result.ok) {
    showToast(result.error, 'error');
    return;
  }
  Object.assign(doc, result.state);
  viewport.reload(toRawProject(doc));
  nameLabel.textContent = doc.meta.name;
  await saveCurrent();
}

fileGroup.appendChild(layout.toolbar.addAction({
  icon: 'upload', label: 'Importar', shortcut: 'Ctrl+O',
  onClick: () => void importCurrent(),
}));

// ── Toolbar: cuenta (C5a) ──────────────────────────────────────
// Sin sesión → abre el modal Login/Registro; con sesión → la cierra.
const authModal = new AuthModal();

/** Abre el modal de Cuenta; al entrar, la nube toma el relevo del proyecto. */
function openAuthModal(): void {
  authModal.open((session) => {
    setSession(session);
    cloudProjectId = null;
    updateAccountButton();
    showToast(`Sesión iniciada: ${session.user.login}`, 'success');
    void initCloudProject();
  });
}

/**
 * Guardar algo en el Studio exige sesión (decisión C5c): sin sesión se avisa y
 * se abre el modal de Cuenta; quien llama aborta la acción y el usuario
 * reintenta ya logueado. true si hay sesión.
 */
function requireSession(accion: string): boolean {
  if (isAuthenticated()) return true;
  showToast(`Inicia sesión para ${accion}`, 'warning');
  openAuthModal();
  return false;
}

const accountBtn = layout.toolbar.addAction({
  icon: 'user', label: 'Cuenta',
  onClick: () => {
    if (isAuthenticated()) {
      clearSession();
      cloudProjectId = null;
      updateAccountButton();
      showToast('Sesión cerrada — inicia sesión para guardar', 'info');
      return;
    }
    openAuthModal();
  },
});
fileGroup.appendChild(accountBtn);

/** Refleja el estado de la sesión en el botón de cuenta. */
function updateAccountButton(): void {
  const session = getSession();
  accountBtn.replaceChildren(Icon(session ? 'user-check' : 'user', 16));
  accountBtn.title = session
    ? `${session.user.login} — cerrar sesión`
    : 'Cuenta — iniciar sesión';
}
updateAccountButton();

layout.toolbar.addSeparator();

// ── Toolbar: undo/redo (pendiente) ─────────────────────────────
const editGroup = layout.toolbar.addGroup();
editGroup.appendChild(layout.toolbar.addAction({
  icon: 'undo', label: 'Deshacer', shortcut: 'Ctrl+Z',
  onClick: () => showToast('Deshacer — pendiente F6', 'info'),
}));
editGroup.appendChild(layout.toolbar.addAction({
  icon: 'redo', label: 'Rehacer', shortcut: 'Ctrl+Shift+Z',
  onClick: () => showToast('Rehacer — pendiente F6', 'info'),
}));

layout.toolbar.addSpacer();
const nameLabel = layout.toolbar.addLabel(doc.meta.name);
layout.toolbar.addSpacer();

// ── Toolbar: panel / playtest ──────────────────────────────────
const miscGroup = layout.toolbar.addGroup();

miscGroup.appendChild(layout.toolbar.addAction({
  icon: 'panel-right', label: 'Panel derecho',
  onClick: () => layout.togglePanelRight(),
}));
const playtestBtn = layout.toolbar.addAction({
  icon: 'play', label: 'Playtest', shortcut: 'F5',
  onClick: () => viewport.setMode(viewport.mode === 'game' ? 'orbit' : 'game'),
});
miscGroup.appendChild(playtestBtn);

// ── Status bar ─────────────────────────────────────────────────
layout.statusBar.setItem('mode', 'Modo: Editor');
layout.statusBar.addSeparator();
layout.statusBar.setItem('coords', 'X: 0  Y: 0  Z: 0');
layout.statusBar.addSeparator();
layout.statusBar.setItem('sector', 'Sector: —');
layout.statusBar.addSeparator();
layout.statusBar.setItem('tool', `Herramienta: ${activeToolId}`);
layout.statusBar.addSeparator();
layout.statusBar.setItem('sel', 'Selección: —');
  layout.statusBar.setItem('terrain', 'Terreno: —');

// ── Coordenadas + modo en tiempo real ──────────────────────────
viewport.onCoordsChange = (x, y, z) => {
  layout.statusBar.setItem('coords', `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}  Z: ${z.toFixed(1)}`);
};
viewport.onModeChange = (mode) => {
  layout.statusBar.setItem('mode', `Modo: ${mode === 'game' ? 'Juego' : 'Editor'}`);
  // El botón de Playtest se convierte en Stop mientras el juego corre.
  playtestBtn.replaceChildren(Icon(mode === 'game' ? 'square' : 'play', 16));
  playtestBtn.title = (mode === 'game' ? 'Detener playtest' : 'Playtest') + ' (F5)';
  showToast(
    mode === 'game'
      ? 'Modo juego — WASD + ratón. Tab para volver.'
      : 'Modo editor — clic izq edita (y orbita en vacío), clic der orbita, medio pan, WASD+QE pan, rueda zoom. Playtest (F5) para jugar.',
    'info', 2500,
  );
};

// ── Atajos globales ────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const key = e.key.toUpperCase();

  // F5 → playtest (evita el recarga del navegador)
  if (key === 'F5' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    viewport.setMode(viewport.mode === 'game' ? 'orbit' : 'game');
    return;
  }

  // Teclas de herramienta (sin ctrl/meta) — números 1..7
  const toolMap: Record<string, ToolId> = {
    '1': 'select', '2': 'vertex', '3': 'move',
    '4': 'wall', '5': 'height', '6': 'entity',
    '7': 'terrain',
  };
  if (toolMap[key] && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    setActiveTool(toolMap[key]);
    return;
  }

  // Tecla 8: popover del cielo (no es herramienta de canvas, pero luce su badge)
  if (key === '8' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    markSkyActive();
    toolManager.openSkyPicker();
    return;
  }

  // Tecla 9: popover de audio (ambiente MVP; música/NPC/acciones, próximas fases)
  if (key === '9' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    markAudioActive();
    toolManager.openAudioPicker();
    return;
  }

  // Ctrl+Shift+S → exportar
  if ((e.ctrlKey || e.metaKey) && key === 'S' && e.shiftKey) {
    e.preventDefault();
    void exportCurrent();
    return;
  }
  // Ctrl+S → guardar
  if ((e.ctrlKey || e.metaKey) && key === 'S') {
    e.preventDefault();
    void saveCurrent();
    return;
  }
  // Ctrl+O → importar
  if ((e.ctrlKey || e.metaKey) && key === 'O') {
    e.preventDefault();
    void importCurrent();
    return;
  }

  // Delete → eliminar selección
  if (key === 'DELETE' || e.key === 'Backspace') {
    if (toolManager.onDelete()) {
      showToast('Eliminado', 'info');
    }
  }
});

// ── Edición en vivo: onChange → reload con THROTTLE ─────────────
// (No debounce puro: el pincel muta el estado cada frame mientras se mantiene
// el clic; un trailing-debounce se re-programa sin descanso y el viewport no
// se entera hasta soltar. El throttle garantiza ~1 reload cada RELOAD_MS.)
// En mundos muy grandes (mapa por defecto de 500 m: 62.500 sectores) cada
// reload copia/valida/reconstruye todo el JSON, así que se espacia más para
// mantener el pincel usable.
function reloadMs(): number {
  return doc.world.sectors.length > 40000 ? 250 : 120;
}
let reloadPending = false;
function scheduleReload(): void {
  if (reloadPending) return;
  reloadPending = true;
  setTimeout(() => {
    reloadPending = false;
    const raw = toRawProject(doc);
    const errors = validateProjectJson(raw);
    if (errors.length > 0) {
      showToast(`Error de validación: ${errors[0]}`, 'warning');
      return;
    }
    viewport.reload(raw);
  }, reloadMs());
}
doc.onChange(scheduleReload);

// ── Helpers ────────────────────────────────────────────────────
function toRawProject(d: EditorState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
}