/**
 * spriteToolUI.ts — modal del Sprite Tool (F5, Fase A).
 *
 * Paso 1 «Cargar»: sube una hoja PNG y la convierte a `PixelImage` (para la
 * lógica pura del slicer). El corte (Paso 2, Auto/Manual) y el animador
 * (Paso 3) llegan en sub-pasos siguientes; aquí solo se carga la hoja y se
 * autocompleta el nombre del asset (decisión aprobada 2).
 *
 * La lógica de negocio está en spriteTool/*.ts (pura, testeada); esta clase
 * solo monta DOM/canvas.
 */

import { Icon } from '../ui/Icon';
import { showToast } from '../ui/Toast';
import { assetIdFromFileName } from './frames';
import type { PixelImage } from './types';

const STEPS = ['1 · Cargar', '2 · Cortar', '3 · Animar', 'Sprites'] as const;

export class SpriteToolUI {
  // Estado del Paso 1 (hoja cargada en memoria; nada se guarda aún).
  private sheet: PixelImage | null = null;
  private sheetUrl: string | null = null;
  assetId: string = '';
  private fileName: string = '';

  private overlay: HTMLDivElement;
  private assetNameInput: HTMLInputElement;
  private continueBtn: HTMLButtonElement;
  private preview: HTMLImageElement | null = null;
  private activeStep = 0;
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

    // Pestañas (la pestaña activa marca el paso; el resto queda deshabilitado
    // hasta que su fase exista).
    const tabs = document.createElement('div');
    tabs.className = 'sprite-tool__tabs';
    STEPS.forEach((label, i) => {
      const btn = document.createElement('button');
      btn.className = 'sprite-tool__tab' + (i === 0 ? ' sprite-tool__tab--active' : '');
      btn.textContent = label;
      btn.disabled = i !== 0;
      btn.addEventListener('click', () => this.setStep(i, btn));
      this.stepEls.push(btn);
      tabs.appendChild(btn);
    });
    modal.appendChild(tabs);

    // Cuerpo: Paso 1 (Cargar) por ahora.
    const body = document.createElement('div');
    body.className = 'sprite-tool__body';

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

    // Drop real: arrastrar y soltar sobre la dropzone.
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

    // Nombre del asset (autocompletado, editable).
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
      this.continueBtn.disabled = this.sheet === null || this.assetId === '';
    });
    nameRow.append(nameLabel, this.assetNameInput);

    // Preview de la hoja cargada.
    this.preview = document.createElement('img');
    this.preview.className = 'sprite-tool__preview';
    this.preview.hidden = true;
    const meta = document.createElement('div');
    meta.className = 'sprite-tool__meta';
    meta.id = 'sprite-tool-meta';

    const step1 = document.createElement('div');
    step1.className = 'sprite-tool__step';
    step1.append(dropzone, nameRow, this.preview, meta);
    body.appendChild(step1);
    modal.appendChild(body);

    // Pie
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    this.continueBtn = document.createElement('button');
    this.continueBtn.className = 'btn btn--primary';
    this.continueBtn.textContent = 'Continuar → Paso 2 (Cortar)';
    this.continueBtn.disabled = true;
    this.continueBtn.addEventListener('click', () => {
      // El Paso 2 (Auto/Manual) llega en el siguiente sub-paso de Fase A.
      showToast('Paso 2 «Cortar» — pendiente del siguiente sub-paso', 'info');
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn--secondary';
    closeBtn.textContent = 'Cerrar';
    closeBtn.addEventListener('click', () => this.close());
    footer.append(this.continueBtn, closeBtn);
    modal.appendChild(footer);

    this.overlay.appendChild(modal);
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  open(): void {
    document.body.appendChild(this.overlay);
    document.addEventListener('keydown', this.onKey);
  }

  close(): void {
    this.overlay.remove();
    document.removeEventListener('keydown', this.onKey);
    // Liberar el blob del preview para no acumular memoria.
    if (this.sheetUrl && this.sheetUrl.startsWith('blob:')) URL.revokeObjectURL(this.sheetUrl);
    this.sheetUrl = null;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  private setStep(i: number, btn: HTMLButtonElement): void {
    this.activeStep = i;
    this.stepEls.forEach((el, j) => el.classList.toggle('sprite-tool__tab--active', j === i));
  }

  /** Carga un archivo de imagen: dibuja a canvas y extrae el PixelImage. */
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
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('sin contexto 2d');
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      this.sheet = { width: imageData.width, height: imageData.height, data: imageData.data };
      this.sheetUrl = URL.createObjectURL(file);
      this.fileName = file.name;

      // Autocompleta el nombre del asset desde el nombre del archivo.
      this.assetNameInput.disabled = false;
      this.assetId = assetIdFromFileName(file.name);
      this.assetNameInput.value = this.assetId;
      this.continueBtn.disabled = false;

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
}