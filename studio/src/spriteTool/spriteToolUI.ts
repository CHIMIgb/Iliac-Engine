/**
 * spriteToolUI.ts — modal del Sprite Tool (F5, Fase A).
 *
 * Paso 1 «Cargar»: sube una hoja PNG y la convierte a `PixelImage` (para la
 * lógica pura del slicer). Paso 2 «Cortar» (modo Auto): detecta las cajas por
 * transparencia con sliders de ajuste fino, preview en vivo y recorte de los
 * frames a <canvas> → dataURL (en memoria, nunca toca la hoja). El modo
 * Manual del Paso 2 y el animador (Paso 3) llegan en sub-pasos siguientes.
 *
 * Toda la lógica de negocio está en spriteTool/*.ts (pura, testeada); esta
 * clase solo monta DOM/canvas.
 */

import { Icon } from '../ui/Icon';
import { showToast } from '../ui/Toast';
import { assetIdFromFileName, cropRegion, textureKeyFor } from './frames';
import { detectSprites } from './detectSprites';
import type { PixelImage, Rect } from './types';

const STEPS = ['1 · Cargar', '2 · Cortar', '3 · Animar', 'Sprites'] as const;

interface CutFrame {
  key: string;
  dataUrl: string;
  w: number;
  h: number;
}

export class SpriteToolUI {
  // Estado compartido entre pasos.
  private sheet: PixelImage | null = null;
  private sheetBmp: ImageBitmap | null = null;
  private sheetUrl: string | null = null;
  assetId: string = '';
  private fileName: string = '';

  // Estado del Paso 2 (Cortar / Auto).
  private cutRects: Rect[] = [];
  private cutFrames: CutFrame[] = [];

  private overlay: HTMLDivElement;
  private assetNameInput: HTMLInputElement;
  private continueBtn: HTMLButtonElement;

  // Paso 2 (Auto)
  private step1: HTMLDivElement;
  private step2: HTMLDivElement;
  private cutCanvas: HTMLCanvasElement;
  private cutStatus: HTMLDivElement;
  private minPixelsInput: HTMLInputElement;
  private gapInput: HTMLInputElement;
  private trimInput: HTMLInputElement;
  private cutBtn: HTMLButtonElement;
  private framesGrid: HTMLDivElement;
  private nextBtn: HTMLButtonElement;
  private preview: HTMLImageElement | null = null;

  private stepEls: HTMLButtonElement[] = [];

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

    // Pestañas (solo Cargar y Cortar habilitadas según el flujo; Animar y
    // Sprites se habilitan en sus fases).
    const tabs = document.createElement('div');
    tabs.className = 'sprite-tool__tabs';
    STEPS.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.className = 'sprite-tool__tab' + (i === 0 ? ' sprite-tool__tab--active' : '');
      btn.textContent = label;
      btn.disabled = i !== 0;
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

    // ── Paso 2: Cortar (modo Auto) ────────────────────────────────
    this.step2 = document.createElement('div');
    this.step2.className = 'sprite-tool__step';
    this.step2.hidden = true;

    const cutHeader = document.createElement('div');
    cutHeader.className = 'sprite-tool__cut-header';
    const modeLabel = document.createElement('span');
    modeLabel.className = 'sprite-tool__mode';
    modeLabel.textContent = 'Modo: Auto — detección por transparencia';
    cutHeader.appendChild(modeLabel);

    // Controles de detección (valores por defecto de detectSprites, editables).
    const controls = document.createElement('div');
    controls.className = 'sprite-tool__controls';

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
    controls.append(minPx.el, gap.el, trimLabel);

    for (const input of [this.minPixelsInput, this.gapInput]) {
      input.addEventListener('input', () => this.redetect());
    }

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

    this.step2.append(cutHeader, controls, this.cutStatus, canvasWrap, this.cutBtn, this.framesGrid);

    body.append(this.step1, this.step2);
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
    this.nextBtn.addEventListener('click', () => {
      // El animador (Paso 3) llega en la Fase B.
      showToast('Paso 3 «Animar» — pendiente de la Fase B', 'info');
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn--secondary';
    closeBtn.textContent = 'Cerrar';
    closeBtn.addEventListener('click', () => this.close());
    footer.append(this.continueBtn, this.nextBtn, closeBtn);
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

  open(): void {
    document.body.appendChild(this.overlay);
    document.addEventListener('keydown', this.onKey);
  }

  close(): void {
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
    // Solo los pasos ya implementados son navegables.
    if (i > 1) {
      showToast('Ese paso llega en una fase posterior', 'info');
      return;
    }
    this.stepEls.forEach((el, j) => el.classList.toggle('sprite-tool__tab--active', j === i));
    this.step1.hidden = i !== 0;
    this.step2.hidden = i !== 1;
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

  /** Activa el Paso 2 y dispara la primera detección. */
  private goToCut(): void {
    if (!this.sheet || this.assetId === '') return;
    this.setStep(1);
    this.redetect();
  }

  /** Re-detecta las cajas con los sliders actuales y redibuja. */
  private redetect(): void {
    if (!this.sheet) return;
    const minPixels = parseInt(this.minPixelsInput.value, 10) || 0;
    const gapTolerance = parseInt(this.gapInput.value, 10) || 0;
    this.cutRects = detectSprites(this.sheet, { minPixels, gapTolerance });
    this.drawCuts();
    const n = this.cutRects.length;
    if (n === 0) {
      this.cutStatus.textContent = 'No se detectaron sprites: la hoja no tiene transparencia o es un tileset. Usa el modo Manual.';
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
      frames.push({ key: textureKeyFor(this.assetId, i), dataUrl, w: cropped.width, h: cropped.height });
    }
    this.cutFrames = frames;
    this.renderFrames();
    this.nextBtn.disabled = frames.length === 0;
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
}