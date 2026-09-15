/**
 * spriteToolUI.ts — modal del Sprite Tool (F5, Fase A).
 *
 * Paso 1 «Cargar»: sube una hoja PNG y la convierte a `PixelImage` (para la
 * lógica pura del slicer). Paso 2 «Cortar» con dos modos:
 *  - Auto: detecta las cajas por transparencia con sliders de ajuste fino.
 *  - Manual: grilla cols×rows con spacing y trailing empty.
 * Ambos con preview en vivo y recorte de los frames a <canvas> → dataURL (en
 * memoria, nunca toca la hoja). El animador (Paso 3) llega en la Fase B.
 *
 * Toda la lógica de negocio está en spriteTool/*.ts (pura, testeada); esta
 * clase solo monta DOM/canvas.
 */

import { Icon } from '../ui/Icon';
import { showToast } from '../ui/Toast';
import { assetIdFromFileName, cropRegion, frameKeyFromFile, textureKeyFor } from './frames';
import { detectSprites } from './detectSprites';
import { gridRects, cellSize } from './gridSlice';
import { defaultAnimTemplate, buildSpriteAnims, reorderFrames, removeFrameIndices, availableFrames, mirrorAnimName, buildMirroredAnim, clampFps, MIN_FPS, MAX_FPS } from './animator';
import type { AnimSpec, SpriteAnimsOutput } from './animator';
import type { SpriteLibrarySnapshot, PixelImage, Rect } from './types';

const STEPS = ['1 · Cargar', '2 · Cortar', '3 · Animar', 'Biblioteca'] as const;

type CutMode = 'auto' | 'manual';

interface CutFrame {
  key: string;
  dataUrl: string;
  w: number;
  h: number;
  /** Bytes RGBA del frame (necesario para espejarlo en 7f; siempre presente). */
  pixel?: PixelImage;
}

export class SpriteToolUI {
  // Estado compartido entre pasos.
  private sheet: PixelImage | null = null;
  private sheetBmp: ImageBitmap | null = null;
  private sheetUrl: string | null = null;
  assetId: string = '';
  private fileName: string = '';

  // Estado del Paso 2 (Cortar).
  private cutMode: CutMode = 'auto';
  private cutRects: Rect[] = [];
  private cutFrames: CutFrame[] = [];
  /** Frames sueltos (PNG individuales, Fase C): sobreviven al re-cortar la hoja. */
  private looseFrames: CutFrame[] = [];

  private overlay: HTMLDivElement;
  private assetNameInput: HTMLInputElement;
  private continueBtn: HTMLButtonElement;

  // Paso 2 (Cortar Auto / Manual)
  private step1: HTMLDivElement;
  private step2: HTMLDivElement;
  private cutCanvas: HTMLCanvasElement;
  private cutStatus: HTMLDivElement;
  private cutBtn: HTMLButtonElement;
  private framesGrid: HTMLDivElement;
  private nextBtn: HTMLButtonElement;
  private preview: HTMLImageElement | null = null;
  private cutModeLabel: HTMLSpanElement;
  private modeSegments: HTMLButtonElement[] = [];

  // Controles de Auto
  private minPixelsInput: HTMLInputElement;
  private gapInput: HTMLInputElement;
  private trimInput: HTMLInputElement;
  // Controles de Manual
  private colsInput: HTMLInputElement;
  private rowsInput: HTMLInputElement;
  private spacingInput: HTMLInputElement;
  private trailingInput: HTMLInputElement;
  private cellInfo: HTMLDivElement;
  private controlsAuto: HTMLDivElement;
  private controlsManual: HTMLDivElement;

  private stepEls: HTMLButtonElement[] = [];

  // ── Estado del Paso 3 (Animar) ──────────────────────────────────
  private step3: HTMLDivElement;
  private animSpecs: AnimSpec[] = [];
  private activeAnim = 0;
  // Preview de reproducción (▶/⏸), acumulador de tiempo para avanzar frames.
  private previewRunning = false;
  private previewElapsed = 0;
  private rafId = 0;
  private lastTs = 0;
  private step3AnimsList: HTMLDivElement;
  private step3PreviewImg: HTMLImageElement;
  private step3FramesGrid: HTMLDivElement;
  private step3Status: HTMLDivElement;
  // Paso 4 (Biblioteca, Fase D): sprites + animaciones guardados en el proyecto.
  private step4: HTMLDivElement;
  private libraryGrid: HTMLDivElement;
  private addFrameBtn: HTMLButtonElement;
  private addFrameMenu: HTMLDivElement;
  private addFrameMenuOpen = false;
  private step3NameInput: HTMLInputElement;
  private step3FpsInput: HTMLInputElement;
  private step3LoopInput: HTMLInputElement;
  private step3PlayBtn: HTMLButtonElement;
  private step3MirrorBtn: HTMLButtonElement;
  private saveBtn: HTMLButtonElement;
  /** Conectado en 7c: guarda texturas + anims en el proyecto real (async OK). */
  onSaveRequested:
    | ((out: SpriteAnimsOutput, frameDataUrls: Record<string, string>) => Promise<void> | void)
    | null = null;

  // Puente F5→6.4: asignar la anim de un sprite del mundo en el playtest.
  private spriteSelect: HTMLSelectElement;
  private assignBtn: HTMLButtonElement;
  private assignRow: HTMLDivElement;
  /** Conectado por main.ts: escribe `sprite.anim` en un sprite existente. */
  onAssignSprite: ((spriteId: string, anim: string) => void) | null = null;

  /** Conectado por main.ts (Fase D1): lee las texturas + anims ya guardadas en el proyecto. */
  onProjectSnapshot: (() => SpriteLibrarySnapshot) | null = null;

  /** Sprites del mundo con los que reasignar anims en la Biblioteca (D4). */
  private worldSprites: Array<{ id: string; label: string }> = [];

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay sprite-tool';

    const modal = document.createElement('div');
    modal.className = 'modal sprite-tool__modal';

    // Cabecera
    const header = document.createElement('div');
    header.className = 'modal__header';
    const title = document.createElement('h2');
    title.className = 'modal__title';
    title.textContent = 'Sprite Tool';
    const closeX = document.createElement('button');
    closeX.className = 'btn btn--icon';
    closeX.title = 'Cerrar (Esc)';
    closeX.appendChild(Icon('x', 16));
    closeX.addEventListener('click', () => this.close());
    header.append(title, closeX);
    modal.appendChild(header);

    // Pestañas: Cargar es la inicial; Cortar/Animar se habilitan según el flujo;
    // Biblioteca siempre está accesible (es solo lectura del proyecto).
    const tabs = document.createElement('div');
    tabs.className = 'sprite-tool__tabs';
    STEPS.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.className = 'sprite-tool__tab' + (i === 0 ? ' sprite-tool__tab--active' : '');
      btn.textContent = label;
      btn.disabled = i !== 0 && i !== 3;
      btn.addEventListener('click', () => this.setStep(i));
      this.stepEls.push(btn);
      tabs.appendChild(btn);
    });
    modal.appendChild(tabs);

    // Cuerpo
    const body = document.createElement('div');
    body.className = 'sprite-tool__body';

    // ── Paso 1: Cargar ────────────────────────────────────────────
    this.step1 = document.createElement('div');
    this.step1.className = 'sprite-tool__step';

    const dropzone = document.createElement('div');
    dropzone.className = 'sprite-tool__dropzone';
    const dzIcon = document.createElement('div');
    dzIcon.className = 'sprite-tool__dropzone-icon';
    dzIcon.appendChild(Icon('image-up', 28));
    const dzText = document.createElement('div');
    dzText.textContent = 'Arrastra tu hoja PNG aquí';
    const dzSub = document.createElement('div');
    dzSub.className = 'sprite-tool__dropzone-sub';
    dzSub.textContent = 'o haz clic para elegir un archivo';
    const dzBtn = document.createElement('button');
    dzBtn.className = 'btn btn--secondary';
    dzBtn.textContent = 'Elegir archivo…';
    dropzone.append(dzIcon, dzText, dzSub, dzBtn);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/png, image/webp';
    fileInput.hidden = true;
    fileInput.addEventListener('change', () => {
      const f = fileInput.files?.[0];
      if (f) void this.loadFile(f);
      fileInput.value = '';
    });
    dropzone.appendChild(fileInput);
    dropzone.addEventListener('click', (e) => {
      if (e.target === dropzone) fileInput.click();
    });
    dzBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      fileInput.click();
    });

    const onDrop = (e: DragEvent): void => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f) void this.loadFile(f);
    };
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('sprite-tool__dropzone--over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('sprite-tool__dropzone--over'));
    dropzone.addEventListener('drop', onDrop);

    const nameRow = document.createElement('div');
    nameRow.className = 'sprite-tool__row';
    const nameLabel = document.createElement('label');
    nameLabel.className = 'sprite-tool__label';
    nameLabel.textContent = 'Nombre del asset';
    nameLabel.htmlFor = 'sprite-tool-asset-name';
    this.assetNameInput = document.createElement('input');
    this.assetNameInput.id = 'sprite-tool-asset-name';
    this.assetNameInput.className = 'sprite-tool__input';
    this.assetNameInput.placeholder = 'guard';
    this.assetNameInput.disabled = true; // hasta cargar hoja
    this.assetNameInput.addEventListener('input', () => {
      this.assetId = this.assetNameInput.value.trim();
      const ready = this.sheet !== null && this.assetId !== '';
      this.continueBtn.disabled = !ready;
      if (ready) this.stepEls[1]!.disabled = false;
    });
    nameRow.append(nameLabel, this.assetNameInput);

    this.preview = document.createElement('img');
    this.preview.className = 'sprite-tool__preview';
    this.preview.hidden = true;
    const meta = document.createElement('div');
    meta.className = 'sprite-tool__meta';
    meta.id = 'sprite-tool-meta';

    this.step1.append(dropzone, nameRow, this.preview, meta);

    // ── Paso 2: Cortar ───────────────────────────────────────────
    this.step2 = document.createElement('div');
    this.step2.className = 'sprite-tool__step';
    this.step2.hidden = true;

    // Cabecera: selector de modo Auto | Manual.
    const cutHeader = document.createElement('div');
    cutHeader.className = 'sprite-tool__cut-header';
    this.cutModeLabel = document.createElement('span');
    this.cutModeLabel.className = 'sprite-tool__mode';
    const segments = document.createElement('div');
    segments.className = 'sprite-tool__segments';
    const autoBtn = document.createElement('button');
    autoBtn.className = 'sprite-tool__segment active';
    autoBtn.textContent = 'Auto';
    const manualBtn = document.createElement('button');
    manualBtn.className = 'sprite-tool__segment';
    manualBtn.textContent = 'Manual';
    autoBtn.addEventListener('click', () => this.setCutMode('auto'));
    manualBtn.addEventListener('click', () => this.setCutMode('manual'));
    this.modeSegments = [autoBtn, manualBtn];
    segments.append(autoBtn, manualBtn);
    cutHeader.append(this.cutModeLabel, segments);

    // Controles del modo Auto (detección por transparencia).
    this.controlsAuto = document.createElement('div');
    this.controlsAuto.className = 'sprite-tool__controls';

    const minPx = this.numberField('Píxeles mínimos', 4, 1, 100);
    this.minPixelsInput = minPx.input;
    const gap = this.numberField('Fusionar cajas (px)', 2, 0, 10);
    this.gapInput = gap.input;
    const trimLabel = document.createElement('label');
    trimLabel.className = 'sprite-tool__checkbox';
    this.trimInput = document.createElement('input');
    this.trimInput.type = 'checkbox';
    const trimText = document.createElement('span');
    trimText.textContent = 'Trim (peligro: desalinea frames)';
    trimText.title = 'Recorta a los píxeles opacos. Rompe el registro entre frames (wobble): solo útil para hojas sin padding uniforme.';
    trimLabel.append(this.trimInput, trimText);
    this.controlsAuto.append(minPx.el, gap.el, trimLabel);

    // Controles del modo Manual (grilla cols×rows).
    this.controlsManual = document.createElement('div');
    this.controlsManual.className = 'sprite-tool__controls';
    this.controlsManual.hidden = true;

    const cols = this.numberField('Columnas', 1, 1, 128);
    this.colsInput = cols.input;
    const rows = this.numberField('Filas', 1, 1, 128);
    this.rowsInput = rows.input;
    const spacing = this.numberField('Spacing (px)', 0, 0, 16);
    this.spacingInput = spacing.input;
    const trailingLabel = document.createElement('label');
    trailingLabel.className = 'sprite-tool__checkbox';
    this.trailingInput = document.createElement('input');
    this.trailingInput.type = 'checkbox';
    const trailingText = document.createElement('span');
    trailingText.textContent = 'Descartar celdas vacías al final';
    trailingLabel.append(this.trailingInput, trailingText);
    this.cellInfo = document.createElement('div');
    this.cellInfo.className = 'sprite-tool__cellinfo';
    this.cellInfo.textContent = 'Celda: —';
    this.controlsManual.append(cols.el, rows.el, spacing.el, trailingLabel, this.cellInfo);

    for (const input of [this.minPixelsInput, this.gapInput]) {
      input.addEventListener('input', () => this.redetect());
    }
    for (const input of [this.colsInput, this.rowsInput, this.spacingInput]) {
      input.addEventListener('input', () => {
        this.updateCellInfo();
        this.redetect();
      });
    }
    this.trailingInput.addEventListener('change', () => this.redetect());

    this.cutStatus = document.createElement('div');
    this.cutStatus.className = 'sprite-tool__cut-status';

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'sprite-tool__canvas-wrap';
    this.cutCanvas = document.createElement('canvas');
    this.cutCanvas.className = 'sprite-tool__canvas';
    canvasWrap.appendChild(this.cutCanvas);

    this.cutBtn = document.createElement('button');
    this.cutBtn.className = 'btn btn--primary';
    this.cutBtn.textContent = 'Recortar → 0 frames';
    this.cutBtn.disabled = true;
    this.cutBtn.addEventListener('click', () => this.cutFramesFromSheet());

    this.framesGrid = document.createElement('div');
    this.framesGrid.className = 'sprite-tool__frames';

    this.step2.append(cutHeader, this.controlsAuto, this.controlsManual, this.cutStatus, canvasWrap, this.cutBtn, this.framesGrid);

    // ── Paso 3: Animar ────────────────────────────────────────────
    this.step3 = document.createElement('div');
    this.step3.className = 'sprite-tool__step';
    this.step3.hidden = true;

    const animLayout = document.createElement('div');
    animLayout.className = 'sprite-tool__anim-layout';

    // Columna izquierda: lista de animaciones.
    const animSide = document.createElement('div');
    animSide.className = 'sprite-tool__anim-side';
    const animTitle = document.createElement('div');
    animTitle.className = 'sprite-tool__label';
    animTitle.textContent = 'Animaciones';
    const newAnimBtn = document.createElement('button');
    newAnimBtn.className = 'btn btn--secondary btn--sm';
    newAnimBtn.textContent = '＋ Nueva anim';
    newAnimBtn.addEventListener('click', () => this.addAnim());
    const animSideHeader = document.createElement('div');
    animSideHeader.className = 'sprite-tool__anim-side-header';
    animSideHeader.append(animTitle, newAnimBtn);
    this.step3AnimsList = document.createElement('div');
    this.step3AnimsList.className = 'sprite-tool__anim-list';
    animSide.append(animSideHeader, this.step3AnimsList);

    // Columna derecha: preview + frames.
    const animMain = document.createElement('div');
    animMain.className = 'sprite-tool__anim-main';

    const previewRow = document.createElement('div');
    previewRow.className = 'sprite-tool__preview-row';
    this.step3PreviewImg = document.createElement('img');
    this.step3PreviewImg.className = 'sprite-tool__preview-frame';
    this.step3PreviewImg.alt = 'frame';
    this.step3PreviewImg.hidden = true;
    const previewCtl = document.createElement('div');
    previewCtl.className = 'sprite-tool__preview-ctl';
    this.step3PlayBtn = document.createElement('button');
    this.step3PlayBtn.className = 'btn btn--secondary btn--sm';
    this.step3PlayBtn.textContent = '▶';
    this.step3PlayBtn.title = 'Reproducir / pausar (también con espacio)';
    this.step3PlayBtn.addEventListener('click', () => this.togglePreview());
    const stepBtn = document.createElement('button');
    stepBtn.className = 'btn btn--secondary btn--sm';
    stepBtn.title = 'Avanza un frame';
    stepBtn.appendChild(Icon('skip-forward', 14));
    stepBtn.addEventListener('click', () => this.stepFrame());
    // Espejo de la anim activa (7f): voltea cada frame y crea `${name}_mirror`
    // para animar hacia la izquierda sin tocar el motor.
    this.step3MirrorBtn = document.createElement('button');
    this.step3MirrorBtn.className = 'btn btn--secondary btn--sm';
    this.step3MirrorBtn.title = 'Crea la copia espejada de esta animación (p. ej. atacar a la izquierda)';
    this.step3MirrorBtn.appendChild(Icon('flip-horizontal-2', 14));
    this.step3MirrorBtn.addEventListener('click', () => this.mirrorActiveAnim());

    const nameLbl = this.labeled('Nombre');
    this.step3NameInput = this.textInput('idle', 'nombre de la animación');
    this.step3NameInput.addEventListener('input', () => this.renameActiveAnim());
    const fpsLbl = this.labeled('fps');
    this.step3FpsInput = document.createElement('input');
    this.step3FpsInput.className = 'sprite-tool__input sprite-tool__fps';
    this.step3FpsInput.type = 'number';
    this.step3FpsInput.min = String(MIN_FPS);
    this.step3FpsInput.max = String(MAX_FPS);
    this.step3FpsInput.value = String(8);
    this.step3FpsInput.addEventListener('input', () => this.applyActiveAnim());
    const loopLbl = document.createElement('label');
    loopLbl.className = 'sprite-tool__checkbox';
    this.step3LoopInput = document.createElement('input');
    this.step3LoopInput.type = 'checkbox';
    this.step3LoopInput.checked = true;
    const loopText = document.createElement('span');
    loopText.textContent = 'loop';
    loopLbl.append(this.step3LoopInput, loopText);
    this.step3LoopInput.addEventListener('change', () => this.applyActiveAnim());

    const fpsField = document.createElement('label');
    fpsField.className = 'sprite-tool__number';
    fpsField.append(fpsLbl, this.step3FpsInput);
    const nameField = document.createElement('label');
    nameField.className = 'sprite-tool__number sprite-tool__field-name';
    nameField.append(nameLbl, this.step3NameInput);

    previewCtl.append(this.step3PlayBtn, stepBtn, this.step3MirrorBtn, nameField, fpsField, loopLbl);
    previewRow.append(this.step3PreviewImg, previewCtl);

    const framesTitle = document.createElement('div');
    framesTitle.className = 'sprite-tool__label';
    framesTitle.textContent = 'Frames (arrastra para reordenar)';
    this.step3FramesGrid = document.createElement('div');
    this.step3FramesGrid.className = 'sprite-tool__frames sprite-tool__frames--dnd';
    // Añadir un frame de la hoja que aún no esté en la anim (7d): menú
    // desplegable con thumbs numerados (previsualización al elegir).
    const addFrameRow = document.createElement('div');
    addFrameRow.className = 'sprite-tool__add-frame';
    this.addFrameBtn = document.createElement('button');
    this.addFrameBtn.className = 'btn btn--secondary btn--sm';
    this.addFrameBtn.textContent = 'Añadir frame';
    this.addFrameBtn.disabled = true;
    this.addFrameBtn.addEventListener('click', () => this.toggleAddFrameMenu());
    // Frames sueltos desde archivos (C2): PNG/WebP individuales a la biblioteca.
    const looseBtn = document.createElement('button');
    looseBtn.className = 'btn btn--secondary btn--sm';
    looseBtn.title = 'Añade PNG/WebP individuales como frames sueltos';
    looseBtn.appendChild(Icon('image-plus', 14));
    looseBtn.appendChild(document.createTextNode(' Añadir frames desde archivo…'));
    const looseInput = document.createElement('input');
    looseInput.type = 'file';
    looseInput.accept = 'image/png, image/webp';
    looseInput.multiple = true;
    looseInput.hidden = true;
    looseBtn.addEventListener('click', () => looseInput.click());
    looseInput.addEventListener('change', () => {
      void this.addLooseFiles(looseInput.files);
      looseInput.value = '';
    });
    this.addFrameMenu = document.createElement('div');
    this.addFrameMenu.className = 'sprite-tool__add-frame-menu';
    this.addFrameMenu.hidden = true;
    addFrameRow.append(this.addFrameBtn, looseBtn, looseInput);
    this.step3Status = document.createElement('div');
    this.step3Status.className = 'sprite-tool__cut-status';

    animMain.append(previewRow, framesTitle, this.step3FramesGrid, addFrameRow, this.addFrameMenu, this.step3Status);

    // Puente hasta el Entity Builder (6.4): asignar la anim a un sprite del mundo.
    this.assignRow = document.createElement('div');
    this.assignRow.className = 'sprite-tool__assign';
    this.assignRow.hidden = true;
    const assignTitle = this.labeled('Asignar a sprite del mundo');
    this.spriteSelect = document.createElement('select');
    this.spriteSelect.className = 'sprite-tool__input sprite-tool__select';
    this.spriteSelect.title = 'El Entity Builder (futuro) permitirá colocar sprites animados; por ahora se asigna a uno existente.';
    this.assignBtn = document.createElement('button');
    this.assignBtn.className = 'btn btn--secondary btn--sm';
    this.assignBtn.textContent = 'Asignar anim activa';
    this.assignBtn.disabled = true;
    this.assignBtn.addEventListener('click', () => {
      const sid = this.spriteSelect.value;
      const spec = this.animSpecs[this.activeAnim];
      if (!sid || !spec || !this.onAssignSprite) return;
      this.onAssignSprite(sid, spec.name);
    });
    this.assignRow.append(assignTitle, this.spriteSelect, this.assignBtn);

    animLayout.append(animSide, animMain);
    this.step3.append(animLayout, this.assignRow);

    // ── Paso 4: Biblioteca (Fase D) ── sprites + animaciones guardadas.
    this.step4 = document.createElement('div');
    this.step4.className = 'sprite-tool__step';
    this.step4.hidden = true;

    const libraryHeader = document.createElement('div');
    libraryHeader.className = 'sprite-tool__label';
    libraryHeader.textContent = 'Sprites y animaciones guardadas en el proyecto';
    this.libraryGrid = document.createElement('div');
    this.libraryGrid.className = 'sprite-tool__frames';
    this.step4.append(libraryHeader, this.libraryGrid);

    body.append(this.step1, this.step2, this.step3, this.step4);
    modal.appendChild(body);

    // Pie
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    this.continueBtn = document.createElement('button');
    this.continueBtn.className = 'btn btn--primary';
    this.continueBtn.textContent = 'Continuar → Paso 2 (Cortar)';
    this.continueBtn.disabled = true;
    this.continueBtn.addEventListener('click', () => this.goToCut());
    this.nextBtn = document.createElement('button');
    this.nextBtn.className = 'btn btn--primary';
    this.nextBtn.textContent = 'Siguiente → Paso 3 (Animar)';
    this.nextBtn.disabled = true;
    this.nextBtn.addEventListener('click', () => this.goToAnimate());
    this.saveBtn = document.createElement('button');
    this.saveBtn.className = 'btn btn--primary';
    this.saveBtn.textContent = 'Guardar en el proyecto';
    this.saveBtn.disabled = true;
    this.saveBtn.addEventListener('click', () => this.handleSave());
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn--secondary';
    closeBtn.textContent = 'Cerrar';
    closeBtn.addEventListener('click', () => this.close());
    footer.append(this.continueBtn, this.nextBtn, this.saveBtn, closeBtn);
    modal.appendChild(footer);

    this.overlay.appendChild(modal);
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  /** Crea un campo numérico con etiqueta y devuelve sus referencias. */
  private numberField(
    labelText: string,
    value: number,
    min: number,
    max: number,
  ): { el: HTMLLabelElement; input: HTMLInputElement } {
    const label = document.createElement('label');
    label.className = 'sprite-tool__number';
    const span = document.createElement('span');
    span.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'number';
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    label.append(span, input);
    return { el: label, input };
  }

  /** Etiqueta suelta (span con la clase de label). */
  private labeled(text: string): HTMLSpanElement {
    const span = document.createElement('span');
    span.className = 'sprite-tool__label';
    span.textContent = text;
    return span;
  }

  /** Input de texto con la clase estándar. */
  private textInput(placeholder: string, title: string): HTMLInputElement {
    const input = document.createElement('input');
    input.className = 'sprite-tool__input';
    input.placeholder = placeholder;
    input.title = title;
    return input;
  }

  open(): void {
    document.body.appendChild(this.overlay);
    document.addEventListener('keydown', this.onKey);
  }

  close(): void {
    this.stopPreview();
    this.overlay.remove();
    document.removeEventListener('keydown', this.onKey);
    // Liberar recursos del preview y del bitmap original.
    if (this.sheetUrl && this.sheetUrl.startsWith('blob:')) URL.revokeObjectURL(this.sheetUrl);
    this.sheetUrl = null;
    if (this.sheetBmp) this.sheetBmp.close();
    this.sheetBmp = null;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  private setStep(i: number): void {
    // Paso 3 solo está disponible con frames (hoja cortada o sueltos);
    // Paso 4 (Biblioteca) siempre accesible: muestra lo guardado en el proyecto.
    if (i === 2 && this.allFrames().length === 0) {
      this.nextBtn.disabled = true;
      return;
    }
    this.stepEls.forEach((el, j) => el.classList.toggle('sprite-tool__tab--active', j === i));
    this.step1.hidden = i !== 0;
    this.step2.hidden = i !== 1;
    this.step3.hidden = i !== 2;
    this.step4.hidden = i !== 3;
    this.stopPreview();
    if (i === 2) {
      this.renderStep3();
      this.previewElapsed = 0;
    } else if (i === 3) {
      this.renderLibraryStep();
    }
  }

  /** Carga un archivo de imagen: extrae PixelImage + ImageBitmap para el preview. */
  private async loadFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      showToast('Solo se admiten imágenes (PNG/WebP)', 'warning');
      return;
    }
    try {
      const bmp = await createImageBitmap(file);
      if (bmp.width === 0 || bmp.height === 0) throw new Error('imagen vacía');
      const canvas = document.createElement('canvas');
      canvas.width = bmp.width;
      canvas.height = bmp.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('sin contexto 2d');
      ctx.drawImage(bmp, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      this.sheet = { width: imageData.width, height: imageData.height, data: imageData.data };
      this.sheetBmp = bmp;
      this.sheetUrl = URL.createObjectURL(file);
      this.fileName = file.name;
      this.cutFrames = [];
      this.looseFrames = []; // hoja nueva → los sueltos se descartan (C2)
      this.framesGrid.textContent = '';

      this.assetNameInput.disabled = false;
      this.assetId = assetIdFromFileName(file.name);
      this.assetNameInput.value = this.assetId;
      this.continueBtn.disabled = false;
      this.stepEls[1]!.disabled = false;

      if (this.preview) {
        this.preview.src = this.sheetUrl;
        this.preview.hidden = false;
      }
      const meta = this.overlay.querySelector('#sprite-tool-meta');
      if (meta) meta.textContent = `${file.name} — ${canvas.width}×${canvas.height} px`;
    } catch (err) {
      console.error('Error cargando hoja:', err);
      showToast('No se pudo cargar esa imagen', 'error');
    }
  }

  /** Lista global de frames reproducibles: hoja cortada + PNGs sueltos (C2). */
  private allFrames(): CutFrame[] {
    return [...this.cutFrames, ...this.looseFrames];
  }

  /** Activa el Paso 2 y dispara la primera detección. */
  private goToCut(): void {
    if (!this.sheet || this.assetId === '') return;
    this.setStep(1);
    // Auto-calcula una grilla sugerida si no había nada.
    if (this.colsInput.value === '1' && this.rowsInput.value === '1' && this.sheet) {
      this.colsInput.value = String(Math.max(1, Math.floor(this.sheet.width / 64)));
      this.rowsInput.value = String(Math.max(1, Math.floor(this.sheet.height / 64)));
    }
    this.updateCellInfo();
    this.redetect();
  }

  /** Alterna entre modo Auto y Manual. */
  private setCutMode(mode: CutMode): void {
    if (mode === this.cutMode) return;
    this.cutMode = mode;
    this.modeSegments[0]!.classList.toggle('active', mode === 'auto');
    this.modeSegments[1]!.classList.toggle('active', mode === 'manual');
    this.controlsAuto.hidden = mode !== 'auto';
    this.controlsManual.hidden = mode !== 'manual';
    this.cutModeLabel.textContent = mode === 'auto'
      ? 'Modo: Auto — detección por transparencia'
      : 'Modo: Manual — grilla columnas × filas';
    this.redetect();
  }

  /** Actualiza el texto derivado de tamaño de celda (informativo). */
  private updateCellInfo(): void {
    if (!this.sheet) return;
    const cols = parseInt(this.colsInput.value, 10) || 1;
    const rows = parseInt(this.rowsInput.value, 10) || 1;
    const s = cellSize(this.sheet.width, this.sheet.height, cols, rows);
    this.cellInfo.textContent = s.cellW > 0 && s.cellH > 0
      ? `Celda: ${s.cellW}×${s.cellH} px`
      : 'Celda: inválida (cols/rows muy altos)';
  }

  /** Re-detecta las cajas con los valores actuales del modo activo y redibuja. */
  private redetect(): void {
    if (!this.sheet) return;
    let rects: Rect[] = [];
    if (this.cutMode === 'auto') {
      const minPixels = parseInt(this.minPixelsInput.value, 10) || 0;
      const gapTolerance = parseInt(this.gapInput.value, 10) || 0;
      rects = detectSprites(this.sheet, { minPixels, gapTolerance });
    } else {
      const cols = parseInt(this.colsInput.value, 10) || 0;
      const rows = parseInt(this.rowsInput.value, 10) || 0;
      const spacing = parseInt(this.spacingInput.value, 10) || 0;
      rects = gridRects(this.sheet, cols, rows, { spacing, trailingEmpty: this.trailingInput.checked });
    }
    this.cutRects = rects;
    this.drawCuts();
    const n = rects.length;
    if (n === 0) {
      this.cutStatus.textContent = this.cutMode === 'auto'
        ? 'No se detectaron sprites: la hoja no tiene transparencia o es un tileset. Usa el modo Manual.'
        : 'Grilla vacía o inválida: ajusta columnas/filas o el tamaño de la hoja.';
      this.cutStatus.classList.add('sprite-tool__cut-status--warn');
    } else {
      this.cutStatus.textContent = `${n} sprites detectados`;
      this.cutStatus.classList.remove('sprite-tool__cut-status--warn');
    }
    this.cutBtn.disabled = n === 0;
    this.cutBtn.textContent = `Recortar → ${n} frames`;
  }

  /** Dibuja la hoja escalada al canvas + las cajas detectadas con números. */
  private drawCuts(): void {
    const canvas = this.cutCanvas;
    const sheet = this.sheet;
    const bmp = this.sheetBmp;
    if (!sheet || !bmp) return;
    const maxW = 520;
    const maxH = 300;
    const scale = Math.min(maxW / sheet.width, maxH / sheet.height, 1);
    canvas.width = Math.max(1, Math.floor(sheet.width * scale));
    canvas.height = Math.max(1, Math.floor(sheet.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    // Cajas detectadas + numeración (row-major = índice de frame).
    ctx.strokeStyle = '#89b4fa';
    ctx.lineWidth = 1;
    ctx.font = '10px monospace';
    ctx.fillStyle = '#89b4fa';
    this.cutRects.forEach((r, i) => {
      const x = Math.floor(r.x * scale);
      const y = Math.floor(r.y * scale);
      const w = Math.max(1, Math.floor(r.w * scale));
      const h = Math.max(1, Math.floor(r.h * scale));
      ctx.strokeRect(x + 0.5, y + 0.5, w, h);
      ctx.fillText(String(i), x + 2, y + 10);
    });
  }

  /** Recorta los frames detectados a dataURL (sin tocar la hoja) y los muestra. */
  private cutFramesFromSheet(): void {
    const sheet = this.sheet;
    if (!sheet || this.cutRects.length === 0) return;
    if (this.assetId === '') {
      showToast('Falta el nombre del asset (Paso 1)', 'warning');
      return;
    }
    const trim = this.trimInput.checked;
    const frames: CutFrame[] = [];
    for (let i = 0; i < this.cutRects.length; i++) {
      const cropped = cropRegion(sheet, this.cutRects[i]!, { trim });
      if (!cropped) continue;
      const dataUrl = this.pixelImageToDataUrl(cropped);
      frames.push({ key: textureKeyFor(this.assetId, i), dataUrl, w: cropped.width, h: cropped.height, pixel: cropped });
    }
    this.cutFrames = frames;
    this.renderFrames();
    this.nextBtn.disabled = frames.length === 0;
    this.initAnimsIfNeeded();
    this.stepEls[2]!.disabled = frames.length === 0;
    this.saveBtn.disabled = true;
    showToast(`${frames.length} frames recortados`, 'success');
  }

  /** Canvas → dataURL de un PixelImage (recorte ya hecho, nunca la hoja entera). */
  private pixelImageToDataUrl(img: PixelImage): string {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    // Se construye el ImageData vacío y se copian los bytes: el tipado de TS
    // no permite pasar un Uint8ClampedArray<ArrayBufferLike> al constructor.
    const id = new ImageData(img.width, img.height);
    id.data.set(img.data);
    ctx.putImageData(id, 0, 0);
    return canvas.toDataURL('image/png');
  }

  /** Grilla de thumbs de los frames recortados. */
  private renderFrames(): void {
    this.framesGrid.textContent = '';
    for (const f of this.cutFrames) {
      const cell = document.createElement('div');
      cell.className = 'sprite-tool__thumb';
      const img = document.createElement('img');
      img.src = f.dataUrl;
      img.alt = f.key;
      img.title = `${f.key} — ${f.w}×${f.h}`;
      const label = document.createElement('span');
      label.textContent = f.key;
      cell.append(img, label);
      this.framesGrid.appendChild(cell);
    }
  }

  // ── Paso 3: Animar ──────────────────────────────────────────────

  /** Activa el Paso 3 (Animar). */
  private goToAnimate(): void {
    if (this.allFrames().length === 0) return;
    this.initAnimsIfNeeded();
    this.setStep(2);
  }

  /**
   * Crea la plantilla idle/walk/attack/death si no hay anims o si los
   * índices apuntan fuera de los frames recortados (hoja re-cortada).
   */
  private initAnimsIfNeeded(): void {
    const n = this.allFrames().length;
    if (n === 0) return;
    const needsRegen =
      this.animSpecs.length === 0 ||
      this.animSpecs.some((s) => s.frameIndices.some((i) => i >= n));
    if (needsRegen) {
      this.animSpecs = defaultAnimTemplate(n);
      this.activeAnim = 0;
    }
  }

  /** Añade una animación nueva con nombre libre y los dos primeros frames. */
  private addAnim(): void {
    const n = this.allFrames().length;
    if (n === 0) return;
    let i = 1;
    const taken = new Set(this.animSpecs.map((s) => s.name));
    let name = 'anim_1';
    while (taken.has(name)) {
      i++;
      name = `anim_${i}`;
    }
    this.animSpecs.push({
      name,
      frameIndices: [0, n > 1 ? 1 : 0],
      fps: 8,
      loop: true,
    });
    this.selectAnim(this.animSpecs.length - 1);
  }

  /** Selecciona una animación y refresca el editor/preview. */
  private selectAnim(i: number): void {
    this.activeAnim = i;
    this.stopPreview();
    this.previewElapsed = 0;
    this.renderStep3();
  }

  /** Renombra la animación activa (nombres únicos; si hay duplicado revierte). */
  private renameActiveAnim(): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec) return;
    const name = this.step3NameInput.value.trim() || spec.name;
    const dup = this.animSpecs.some((s, j) => j !== this.activeAnim && s.name === name);
    if (dup) {
      this.step3NameInput.value = spec.name;
      showToast('Ese nombre ya existe', 'warning');
      return;
    }
    spec.name = name;
    this.renderAnimsList();
  }

  /** Aplica fps/loop (y nombre ya validado) de los inputs a la anim activa. */
  private applyActiveAnim(): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec) return;
    spec.fps = clampFps(parseInt(this.step3FpsInput.value, 10) || 8);
    spec.loop = this.step3LoopInput.checked;
    this.step3FpsInput.value = String(spec.fps);
    this.renderAnimsList();
  }

  /** Elimina la animación activa (mantiene la plantilla ≥1 si hay más). */
  private removeAnim(i: number): void {
    if (this.animSpecs.length <= 1) {
      showToast('Deja al menos una animación', 'warning');
      return;
    }
    this.animSpecs.splice(i, 1);
    if (this.activeAnim >= this.animSpecs.length) this.activeAnim = this.animSpecs.length - 1;
    this.stopPreview();
    this.previewElapsed = 0;
    this.renderStep3();
  }

  /** Repinta la lista lateral de animaciones. */
  private renderAnimsList(): void {
    this.step3AnimsList.textContent = '';
    this.animSpecs.forEach((spec, i) => {
      const row = document.createElement('div');
      row.className = 'sprite-tool__anim-item' + (i === this.activeAnim ? ' active' : '');
      const name = document.createElement('span');
      name.className = 'sprite-tool__anim-name';
      name.textContent = spec.name;
      const badge = document.createElement('span');
      badge.className = 'sprite-tool__anim-badge';
      badge.textContent = `${spec.frameIndices.length} frames`;
      const del = document.createElement('button');
      del.className = 'btn btn--icon btn--sm';
      del.title = `Eliminar «${spec.name}»`;
      del.appendChild(Icon('trash', 12));
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeAnim(i);
      });
      row.append(name, badge, del);
      row.addEventListener('click', () => this.selectAnim(i));
      this.step3AnimsList.appendChild(row);
    });
  }

  /** Índice del frame que se muestra en el preview (según tiempo transcurrido). */
  private previewFrameIndex(): number {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec || spec.frameIndices.length === 0) return 0;
    const raw = Math.floor(this.previewElapsed * (spec.fps || 0.0001));
    // fps válido (clamp 1–60) → mod (loop) o clamp (sin loop).
    if (spec.loop) {
      return raw % spec.frameIndices.length;
    }
    return Math.min(spec.frameIndices.length - 1, raw);
  }

  /** Frame actual en dataURL (o vacío si no hay). */
  private currentPreviewDataUrl(): string {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec) return '';
    const idx = this.previewFrameIndex();
    const frame = this.allFrames()[spec.frameIndices[idx] ?? -1];
    return frame ? frame.dataUrl : '';
  }

  /** Repinta el editor completo del Paso 3. */
  private renderStep3(): void {
    this.saveBtn.disabled = this.animSpecs.length === 0;
    const spec = this.animSpecs[this.activeAnim];
    this.assignBtn.textContent = spec ? `Asignar anim «${spec.name}»` : 'Asignar anim activa';
    this.assignBtn.disabled = !spec || this.spriteSelect.value === '';
    if (!spec) {
      this.step3Status.textContent = 'Sin animaciones: pulsa «＋ Nueva anim».';
      this.step3Status.classList.add('sprite-tool__cut-status--warn');
      this.step3AnimsList.textContent = '';
      this.step3FramesGrid.textContent = '';
      this.renderAddFrameMenu();
      this.step3PreviewImg.hidden = true;
      return;
    }
    this.step3Status.classList.remove('sprite-tool__cut-status--warn');
    this.step3Status.textContent = `Animación «${spec.name}» — ${spec.frameIndices.length} frames`;
    this.step3NameInput.value = spec.name;
    this.step3FpsInput.value = String(spec.fps);
    this.step3LoopInput.checked = spec.loop;
    this.renderAnimsList();
    this.renderActiveFrames();
    this.renderAddFrameMenu();
    this.updatePreviewImage();
  }

  /** Thumbs de la anim activa con drag & drop HTML5 nativo (reordenar). */
  private renderActiveFrames(): void {
    const spec = this.animSpecs[this.activeAnim];
    this.step3FramesGrid.textContent = '';
    if (!spec) return;
    spec.frameIndices.forEach((frameIdx, pos) => {
      const frame = this.allFrames()[frameIdx];
      if (!frame) return;
      const cell = document.createElement('div');
      cell.className = 'sprite-tool__thumb sprite-tool__dnd';
      cell.draggable = true;
      const img = document.createElement('img');
      img.src = frame.dataUrl;
      img.alt = frame.key;
      img.title = `${frame.key} — ${pos + 1}º de ${spec.frameIndices.length}`;
      img.dataset.pos = String(pos);
      const label = document.createElement('span');
      label.textContent = String(pos + 1);
      // Quitar este frame de la anim (7d): mínimo 2 según contrato del motor.
      const rm = document.createElement('button');
      rm.className = 'sprite-tool__thumb--remove';
      rm.title = 'Quitar este frame de la animación';
      rm.appendChild(Icon('x', 10));
      rm.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFrameFromActive(pos);
      });
      cell.append(img, label, rm);

      cell.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', String(pos));
        cell.classList.add('dragging');
      });
      cell.addEventListener('dragend', () => cell.classList.remove('dragging'));
      cell.addEventListener('dragover', (e) => {
        e.preventDefault();
        cell.classList.add('over');
      });
      cell.addEventListener('dragleave', () => cell.classList.remove('over'));
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        cell.classList.remove('over');
        const from = parseInt(e.dataTransfer?.getData('text/plain') ?? '', 10);
        if (!Number.isNaN(from) && spec) {
          spec.frameIndices = reorderFrames(spec.frameIndices, from, pos);
          this.renderActiveFrames();
          this.updatePreviewImage();
        }
      });
      this.step3FramesGrid.appendChild(cell);
    });
  }

  /** Quita un frame de la anim activa (7d): mínimo 2 según contrato del motor. */
  private removeFrameFromActive(pos: number): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec) return;
    const next = removeFrameIndices(spec.frameIndices, pos);
    if (next.length === spec.frameIndices.length) {
      showToast('Una animación necesita al menos 2 frames', 'warning');
      return;
    }
    spec.frameIndices = next;
    this.renderStep3();
  }

  /** Alterna la visibilidad del menú de "Añadir frame". */
  private toggleAddFrameMenu(): void {
    this.addFrameMenuOpen = !this.addFrameMenuOpen;
    this.renderAddFrameMenu();
  }

  /**
   * Construye el menú de "Añadir frame" (7d): thumbs de los frames de la
   * hoja sin usar, numerados 1-based igual que al cortar, y con
   * previsualización. Click en un thumb → se añade al final de la anim.
   */
  private renderAddFrameMenu(): void {
    const spec = this.animSpecs[this.activeAnim];
    this.addFrameMenu.textContent = '';
    if (!spec) {
      this.addFrameBtn.disabled = true;
      this.addFrameMenu.hidden = true;
      return;
    }
    const idcs = availableFrames(spec.frameIndices, this.allFrames().length);
    this.addFrameBtn.disabled = idcs.length === 0;
    if (!this.addFrameMenuOpen) {
      this.addFrameMenu.hidden = true;
      return;
    }
    if (idcs.length === 0) {
      const msg = document.createElement('div');
      msg.className = 'sprite-tool__cut-status sprite-tool__cut-status--warn';
      msg.textContent = 'Todos los frames de la hoja ya están en la animación.';
      this.addFrameMenu.appendChild(msg);
      this.addFrameMenu.hidden = false;
      return;
    }
    for (const i of idcs) {
      const frame = this.allFrames()[i];
      if (!frame) continue;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'sprite-tool__thumb sprite-tool__thumb--pick';
      const img = document.createElement('img');
      img.src = frame.dataUrl;
      img.alt = frame.key;
      img.title = `${frame.key} — ${frame.w}×${frame.h}`;
      const label = document.createElement('span');
      label.textContent = String(i + 1); // numeración de celda, igual que al cortar
      cell.append(img, label);
      cell.addEventListener('click', () => this.addFrameFromActive(i));
      this.addFrameMenu.appendChild(cell);
    }
    this.addFrameMenu.hidden = false;
  }

  /** Añade al final de la anim activa el frame elegido; el menú se mantiene
   *  abierto para seguir colocando frames (solicitud del usuario). */
  private addFrameFromActive(i: number): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec || spec.frameIndices.includes(i)) return;
    spec.frameIndices.push(i);
    this.renderStep3();
  }

  /** Pinta el Paso 4 (Biblioteca, Fase D): cards por animación guardada
   *  con thumbnails de cada frame desde las texturas del proyecto. */
  private renderLibraryStep(): void {
    this.libraryGrid.textContent = '';
    const snapshot = this.getProjectSnapshot();
    const animEntries = snapshot ? Object.entries(snapshot.spriteAnims) : [];

    if (!snapshot || animEntries.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'sprite-tool__cut-status sprite-tool__cut-status--warn';
      if (!snapshot) empty.textContent = 'La Biblioteca no está conectada al proyecto.';
      else if (Object.keys(snapshot.textures).length === 0) {
        empty.textContent = 'Aún no hay sprites ni animaciones guardadas en el proyecto.';
      } else {
        empty.textContent = `Hay ${Object.keys(snapshot.textures).length} textura(s) guardada(s) pero ninguna animación todavía. Crea una en el Paso 3.`;
      }
      this.libraryGrid.appendChild(empty);
      return;
    }

    for (const [name, animSpec] of animEntries) {
      const card = document.createElement('div');
      card.className = 'sprite-tool__library-card';

      // Cabecera: nombre + info resumen.
      const header = document.createElement('div');
      header.className = 'sprite-tool__library-card-header';
      const title = document.createElement('strong');
      title.textContent = name;
      const info = document.createElement('span');
      info.className = 'muted';
      const fps = animSpec.fps ?? 4;
      info.textContent = `${animSpec.frames.length} frames · ${fps} fps · ${animSpec.loop ? 'loop' : 'una vez'}`;
      header.append(title, info);

      // Thumbnails de los frames de la animación.
      const thumbs = document.createElement('div');
      thumbs.className = 'sprite-tool__frames';
      for (const key of animSpec.frames) {
        const url = snapshot.textures[key];
        if (!url) continue;
        const cell = document.createElement('div');
        cell.className = 'sprite-tool__thumb';
        cell.title = key;
        const img = document.createElement('img');
        img.src = String(url);
        img.alt = key;
        cell.appendChild(img);
        thumbs.appendChild(cell);
      }

      card.append(header, thumbs);

      // Acción D4: asignar esta anim guardada a un sprite del mundo.
      const assignRow = document.createElement('div');
      assignRow.className = 'sprite-tool__assign';
      const assignSelect = document.createElement('select');
      assignSelect.className = 'sprite-tool__select';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = this.worldSprites.length === 0 ? 'No hay sprites en el mundo' : 'Asignar a sprite…';
      assignSelect.appendChild(placeholder);
      for (const it of this.worldSprites) {
        const opt = document.createElement('option');
        opt.value = it.id;
        opt.textContent = it.label;
        assignSelect.appendChild(opt);
      }
      const assignBtn = document.createElement('button');
      assignBtn.className = 'btn btn--secondary btn--sm';
      assignBtn.textContent = 'Asignar';
      assignBtn.disabled = this.worldSprites.length === 0;
      assignBtn.addEventListener('click', () => {
        if (!assignSelect.value) {
          showToast('Elige un sprite primero', 'info');
          return;
        }
        if (!this.onAssignSprite) {
          showToast('Asignación no conectada al proyecto', 'error');
          return;
        }
        this.onAssignSprite(assignSelect.value, name);
      });
      assignRow.append(assignSelect, assignBtn);
      card.appendChild(assignRow);

      this.libraryGrid.appendChild(card);
    }
  }

  /** Espejo de la anim activa (7f): voltea cada frame y crea `${name}_mirror`
   *  con los mismos fps/loop; selecciona la anim espejada al crearla. */
  private mirrorActiveAnim(): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec) return;
    const mirroredName = mirrorAnimName(spec.name);
    if (this.animSpecs.some((s) => s.name === mirroredName)) {
      showToast(`La animación «${mirroredName}» ya existe`, 'warning');
      return;
    }
    const source: { key: string; pixel: PixelImage }[] = [];
    const seen = new Set<string>();
    const all = this.allFrames();
    for (const i of spec.frameIndices) {
      const f = all[i];
      if (!f?.pixel || seen.has(f.key)) continue;
      seen.add(f.key);
      source.push({ key: f.key, pixel: f.pixel });
    }
    if (source.length === 0) {
      showToast('No hay frames con píxeles para espejar', 'warning');
      return;
    }
    const { frames, spec: mirrored } = buildMirroredAnim(spec.name, source, spec.fps, spec.loop);
    const offset = all.length;
    const newFrames: CutFrame[] = frames.map((f) => ({
      key: f.key,
      dataUrl: this.pixelImageToDataUrl(f.pixel),
      w: f.pixel.width,
      h: f.pixel.height,
      pixel: f.pixel,
    }));
    this.looseFrames.push(...newFrames); // sobreviven al re-cortar la hoja
    mirrored.frameIndices = mirrored.frameIndices.map((k) => offset + k);
    this.animSpecs.push(mirrored);
    this.activeAnim = this.animSpecs.length - 1;
    this.renderStep3();
    showToast(`Animación espejada «${mirroredName}» creada`, 'success');
  }

  /** Carga PNG/WebP individuales como frames sueltos (C2). Convierte cada
   *  archivo a PixelImage + dataURL, evita keys duplicadas y refresca el Paso 3. */
  private async addLooseFiles(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    if (this.assetId === '') {
      showToast('Pon un nombre de asset (Paso 1) antes de añadir frames', 'warning');
      return;
    }
    let added = 0;
    let skipped = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        skipped++;
        continue;
      }
      try {
        const bmp = await createImageBitmap(file);
        if (bmp.width === 0 || bmp.height === 0) throw new Error('imagen vacía');
        const canvas = document.createElement('canvas');
        canvas.width = bmp.width;
        canvas.height = bmp.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('sin contexto 2d');
        ctx.drawImage(bmp, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixel: PixelImage = { width: imageData.width, height: imageData.height, data: imageData.data };
        const key = frameKeyFromFile(this.assetId, file.name);
        const all = this.allFrames();
        if (all.some((f) => f.key === key)) {
          skipped++;
          continue;
        }
        const dataUrl = this.pixelImageToDataUrl(pixel);
        this.looseFrames.push({ key, dataUrl, w: pixel.width, h: pixel.height, pixel });
        added++;
      } catch (err) {
        console.error('Error añadiendo frame suelto:', err);
        skipped++;
      }
    }
    if (added === 0) {
      if (skipped > 0) showToast('Ningún frame añadido: duplicados o archivos inválidos', 'warning');
      return;
    }
    this.initAnimsIfNeeded();
    this.nextBtn.disabled = false;
    this.stepEls[2]!.disabled = false;
    this.renderStep3();
    const msgSkipped = skipped > 0 ? `, ${skipped} omitidos` : '';
    showToast(added === 1 ? `1 frame suelto añadido${msgSkipped}` : `${added} frames sueltos añadidos${msgSkipped}`, skipped > 0 ? 'warning' : 'success');
  }

  /** Actualiza el <img> del preview con el frame activo. */
  private updatePreviewImage(): void {
    const url = this.currentPreviewDataUrl();
    if (url) {
      this.step3PreviewImg.src = url;
      this.step3PreviewImg.hidden = false;
    } else {
      this.step3PreviewImg.hidden = true;
    }
  }

  /** ▶ / ⏸ del preview. */
  private togglePreview(): void {
    if (this.previewRunning) this.stopPreview();
    else this.startPreview();
  }

  private startPreview(): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec || spec.frameIndices.length === 0) return;
    this.previewRunning = true;
    this.step3PlayBtn.textContent = '⏸';
    this.previewElapsed = 0;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  private stopPreview(): void {
    this.previewRunning = false;
    this.step3PlayBtn.textContent = '▶';
    cancelAnimationFrame(this.rafId);
  }

  private tick = (ts: number): void => {
    if (!this.previewRunning) return;
    const dt = Math.min(0.1, Math.max(0, (ts - this.lastTs) / 1000));
    this.lastTs = ts;
    this.previewElapsed += dt;
    this.updatePreviewImage();
    this.rafId = requestAnimationFrame(this.tick);
  };

  /** Avanza un frame manualmente (deteniendo la reproducción en curso). */
  private stepFrame(): void {
    const spec = this.animSpecs[this.activeAnim];
    if (!spec || spec.frameIndices.length === 0) return;
    this.stopPreview();
    const cur = this.previewFrameIndex();
    const next = spec.loop
      ? (cur + 1) % spec.frameIndices.length
      : Math.min(spec.frameIndices.length - 1, cur + 1);
    this.previewElapsed = next / clampFps(spec.fps);
    this.updatePreviewImage();
  }

  /** Construye la salida y la envía (7b: valida; 7c: conecta el guardado). */
  private handleSave(): void {
    // 7f/C2: las keys reales de cada frame (hoja `_f{index}`, espejadas `_mirror`
    // o sueltas) permiten a buildSpriteAnims generar texturas para TODAS las anims.
    const all = this.allFrames();
    const frameKeys = all.map((f) => f.key);
    const out = buildSpriteAnims(this.assetId, all.length, this.animSpecs, frameKeys);
    if (out.errors.length > 0) {
      showToast(`Animación inválida: ${out.errors[0]}`, 'error');
      return;
    }
    this.saveBtn.disabled = false;
    if (this.onSaveRequested) {
      // Mapa key → dataURL para que main.ts suba cada frame al middleware.
      const frameDataUrls: Record<string, string> = {};
      for (let i = 0; i < all.length; i++) {
        frameDataUrls[all[i]!.key] = all[i]!.dataUrl;
      }
      void this.onSaveRequested(out, frameDataUrls);
    } else {
      showToast('Guardado real pendiente (siguiente paso)', 'info');
    }
  }

  /**
   * Inyecta los sprites del mundo para el puente "Asignar a sprite del mundo".
   * Lo llama main.ts al abrir el modal (el UI no conoce EditorState).
   */
  setWorldSprites(items: Array<{ id: string; label: string }>): void {
    this.worldSprites = items;
    this.spriteSelect.textContent = '';
    if (items.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No hay sprites en el mundo';
      this.spriteSelect.appendChild(opt);
      this.assignRow.hidden = true;
      return;
    }
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Elegir sprite…';
    this.spriteSelect.appendChild(placeholder);
    for (const it of items) {
      const opt = document.createElement('option');
      opt.value = it.id;
      opt.textContent = it.label;
      this.spriteSelect.appendChild(opt);
    }
    this.assignRow.hidden = false;
    this.assignBtn.disabled = this.animSpecs.length === 0;
  }

  /**
   * Snapshot del proyecto para la Biblioteca (Fase D1): texturas + anims
   * guardadas, o null si main.ts no conectó el callback (modo lectura).
   */
  getProjectSnapshot(): SpriteLibrarySnapshot | null {
    return this.onProjectSnapshot ? this.onProjectSnapshot() : null;
  }
}