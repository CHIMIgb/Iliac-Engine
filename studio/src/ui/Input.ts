/**
 * Input.ts — Inputs: TextInput, NumberInput, Select, Checkbox, Slider, ColorInput, FileInput
 * BEM: .input, .input--error, .input__label, .input__help, .input__wrapper
 */

import { createIcon } from './Icon.js';
import { escapeHTML } from './utils.js';

export type InputType = 'text' | 'number' | 'select' | 'checkbox' | 'slider' | 'color' | 'file';

export interface BaseInputOptions {
  id: string;
  label?: string;
  help?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  onChange?: (value: string | number | boolean | FileList | null) => void;
}

export interface TextInputOptions extends BaseInputOptions {
  type: 'text';
  value?: string;
  placeholder?: string;
  pattern?: string;
  maxLength?: number;
}

export interface NumberInputOptions extends BaseInputOptions {
  type: 'number';
  value?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface SelectInputOptions extends BaseInputOptions {
  type: 'select';
  value?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  multiple?: boolean;
}

export interface CheckboxInputOptions extends BaseInputOptions {
  type: 'checkbox';
  checked?: boolean;
  label?: string; // Para checkbox, el label va a la derecha
}

export interface SliderInputOptions extends BaseInputOptions {
  type: 'slider';
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
}

export interface ColorInputOptions extends BaseInputOptions {
  type: 'color';
  value?: string; // hex #rrggbb
}

export interface FileInputOptions extends BaseInputOptions {
  type: 'file';
  accept?: string;
  multiple?: boolean;
  dropZone?: boolean;
}

export type InputOptions =
  | TextInputOptions
  | NumberInputOptions
  | SelectInputOptions
  | CheckboxInputOptions
  | SliderInputOptions
  | ColorInputOptions
  | FileInputOptions;

/**
 * Crea un input según el tipo y retorna el contenedor wrapper.
 */
export function createInput(options: InputOptions): HTMLElement {
  const {
    id,
    label,
    help,
    error,
    disabled = false,
    required = false,
    className = '',
    onChange,
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = `input-wrapper ${className}`.trim();
  if (error) wrapper.classList.add('input-wrapper--error');

  // Label
  if (label && options.type !== 'checkbox') {
    const labelEl = document.createElement('label');
    labelEl.htmlFor = id;
    labelEl.className = 'input__label';
    labelEl.textContent = label;
    if (required) {
      const req = document.createElement('span');
      req.className = 'input__required';
      req.textContent = ' *';
      req.style.color = 'var(--accent-danger)';
      labelEl.appendChild(req);
    }
    wrapper.appendChild(labelEl);
  }

  // Input principal
  let inputEl: HTMLElement;

  switch (options.type) {
    case 'text':
      inputEl = createTextInput(options as TextInputOptions, id, disabled, onChange);
      break;
    case 'number':
      inputEl = createNumberInput(options as NumberInputOptions, id, disabled, onChange);
      break;
    case 'select':
      inputEl = createSelectInput(options as SelectInputOptions, id, disabled, onChange);
      break;
    case 'checkbox':
      inputEl = createCheckboxInput(options as CheckboxInputOptions, id, disabled, onChange);
      break;
    case 'slider':
      inputEl = createSliderInput(options as SliderInputOptions, id, disabled, onChange);
      break;
    case 'color':
      inputEl = createColorInput(options as ColorInputOptions, id, disabled, onChange);
      break;
    case 'file':
      inputEl = createFileInput(options as FileInputOptions, id, disabled, onChange);
      break;
    default:
      throw new Error(`Unknown input type: ${(options as InputOptions).type}`);
  }

  wrapper.appendChild(inputEl);

  // Help / Error text
  const msgEl = document.createElement('div');
  msgEl.className = error ? 'input__error' : 'input__help';
  msgEl.textContent = error || help || '';
  msgEl.id = `${id}-msg`;
  if (error) msgEl.style.color = 'var(--accent-danger)';
  else msgEl.style.color = 'var(--text-muted)';
  wrapper.appendChild(msgEl);

  // ARIA
  inputEl.setAttribute('aria-describedby', `${id}-msg`);
  if (error) inputEl.setAttribute('aria-invalid', 'true');

  return wrapper;
}

/**
 * Renderiza input como HTML string.
 */
export function inputHTML(options: InputOptions): string {
  const {
    id,
    label,
    help,
    error,
    disabled = false,
    required = false,
    className = '',
    type,
  } = options;

  const wrapperClass = `input-wrapper ${className} ${error ? 'input-wrapper--error' : ''}`.trim();
  const msgClass = error ? 'input__error' : 'input__help';
  const msgText = error || help || '';
  const msgId = `${id}-msg`;

  let labelHTML = '';
  if (label && type !== 'checkbox') {
    const req = required ? `<span class="input__required" style="color:var(--accent-danger)"> *</span>` : '';
    labelHTML = `<label class="input__label" for="${id}">${escapeHTML(label)}${req}</label>`;
  }

  let inputHTML = '';
  switch (type) {
    case 'text':
      inputHTML = textInputHTML(options as TextInputOptions, id, disabled);
      break;
    case 'number':
      inputHTML = numberInputHTML(options as NumberInputOptions, id, disabled);
      break;
    case 'select':
      inputHTML = selectInputHTML(options as SelectInputOptions, id, disabled);
      break;
    case 'checkbox':
      inputHTML = checkboxInputHTML(options as CheckboxInputOptions, id, disabled);
      break;
    case 'slider':
      inputHTML = sliderInputHTML(options as SliderInputOptions, id, disabled);
      break;
    case 'color':
      inputHTML = colorInputHTML(options as ColorInputOptions, id, disabled);
      break;
    case 'file':
      inputHTML = fileInputHTML(options as FileInputOptions, id, disabled);
      break;
  }

  const msgHTML = `<div class="${msgClass}" id="${msgId}" style="color:var(${error ? '--accent-danger' : '--text-muted'})">${escapeHTML(msgText)}</div>`;

  return `<div class="${wrapperClass}">${labelHTML}${inputHTML}${msgHTML}</div>`;
}

// ============================================================================
// IMPLEMENTACIONES POR TIPO
// ============================================================================

function createTextInput(opts: TextInputOptions, id: string, disabled: boolean, onChange?: (v: string) => void): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.id = id;
  input.className = 'input';
  input.value = opts.value ?? '';
  input.placeholder = opts.placeholder ?? '';
  input.disabled = disabled;
  input.required = opts.required ?? false;
  if (opts.pattern) input.pattern = opts.pattern;
  if (opts.maxLength) input.maxLength = opts.maxLength;
  input.addEventListener('input', () => onChange?.(input.value));
  input.addEventListener('blur', () => onChange?.(input.value));
  return input;
}

function textInputHTML(opts: TextInputOptions, id: string, disabled: boolean): string {
  const attrs = [
    `type="text"`,
    `id="${id}"`,
    `class="input"`,
    `value="${escapeHTML(opts.value ?? '')}"`,
    `placeholder="${escapeHTML(opts.placeholder ?? '')}"`,
    disabled ? 'disabled' : '',
    opts.required ? 'required' : '',
    opts.pattern ? `pattern="${escapeHTML(opts.pattern)}"` : '',
    opts.maxLength ? `maxlength="${opts.maxLength}"` : '',
  ].filter(Boolean).join(' ');
  return `<input ${attrs} />`;
}

function createNumberInput(opts: NumberInputOptions, id: string, disabled: boolean, onChange?: (v: number | null) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'input__number-wrapper';

  const input = document.createElement('input');
  input.type = 'number';
  input.id = id;
  input.className = 'input input__number';
  input.value = String(opts.value ?? '');
  input.placeholder = opts.placeholder ?? '';
  input.min = String(opts.min ?? '');
  input.max = String(opts.max ?? '');
  input.step = String(opts.step ?? 1);
  input.disabled = disabled;
  input.required = opts.required ?? false;
  input.addEventListener('input', () => {
    const val = input.value === '' ? null : Number(input.value);
    onChange?.(val);
  });
  input.addEventListener('blur', () => {
    const val = input.value === '' ? null : Number(input.value);
    onChange?.(val);
  });

  // Flechas up/down
  const btnUp = document.createElement('button');
  btnUp.type = 'button';
  btnUp.className = 'input__number-btn';
  btnUp.disabled = disabled;
  btnUp.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>';
  btnUp.addEventListener('click', () => {
    const current = Number(input.value) || 0;
    const step = Number(opts.step) || 1;
    const max = opts.max !== undefined ? opts.max : Infinity;
    input.value = String(Math.min(current + step, max));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  const btnDown = document.createElement('button');
  btnDown.type = 'button';
  btnDown.className = 'input__number-btn';
  btnDown.disabled = disabled;
  btnDown.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>';
  btnDown.addEventListener('click', () => {
    const current = Number(input.value) || 0;
    const step = Number(opts.step) || 1;
    const min = opts.min !== undefined ? opts.min : -Infinity;
    input.value = String(Math.max(current - step, min));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  wrapper.appendChild(input);
  wrapper.appendChild(btnUp);
  wrapper.appendChild(btnDown);
  return wrapper;
}

function numberInputHTML(opts: NumberInputOptions, id: string, disabled: boolean): string {
  const attrs = [
    `type="number"`,
    `id="${id}"`,
    `class="input input__number"`,
    `value="${escapeHTML(String(opts.value ?? ''))}"`,
    `placeholder="${escapeHTML(opts.placeholder ?? '')}"`,
    `min="${opts.min ?? ''}"`,
    `max="${opts.max ?? ''}"`,
    `step="${opts.step ?? 1}"`,
    disabled ? 'disabled' : '',
    opts.required ? 'required' : '',
  ].filter(Boolean).join(' ');
  return `
    <div class="input__number-wrapper">
      <input ${attrs} />
      <button type="button" class="input__number-btn" ${disabled ? 'disabled' : ''} aria-label="Incrementar">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"/></svg>
      </button>
      <button type="button" class="input__number-btn" ${disabled ? 'disabled' : ''} aria-label="Decrementar">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
    </div>
  `;
}

function createSelectInput(opts: SelectInputOptions, id: string, disabled: boolean, onChange?: (v: string) => void): HTMLSelectElement {
  const select = document.createElement('select');
  select.id = id;
  select.className = 'input input__select';
  select.disabled = disabled;
  select.required = opts.required ?? false;
  select.multiple = opts.multiple ?? false;

  if (opts.placeholder) {
    const placeholderOpt = document.createElement('option');
    placeholderOpt.value = '';
    placeholderOpt.disabled = true;
    placeholderOpt.selected = !opts.value;
    placeholderOpt.textContent = opts.placeholder;
    select.appendChild(placeholderOpt);
  }

  for (const opt of opts.options) {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    option.selected = opt.value === opts.value;
    select.appendChild(option);
  }

  select.addEventListener('change', () => onChange?.(select.value));
  return select;
}

function selectInputHTML(opts: SelectInputOptions, id: string, disabled: boolean): string {
  const placeholder = opts.placeholder ? `<option value="" disabled ${!opts.value ? 'selected' : ''}>${escapeHTML(opts.placeholder)}</option>` : '';
  const options = opts.options.map(o => `<option value="${escapeHTML(o.value)}" ${o.value === opts.value ? 'selected' : ''}>${escapeHTML(o.label)}</option>`).join('');
  const attrs = [
    `id="${id}"`,
    `class="input input__select"`,
    disabled ? 'disabled' : '',
    opts.required ? 'required' : '',
    opts.multiple ? 'multiple' : '',
  ].filter(Boolean).join(' ');
  return `<select ${attrs}>${placeholder}${options}</select>`;
}

function createCheckboxInput(opts: CheckboxInputOptions, id: string, disabled: boolean, onChange?: (v: boolean) => void): HTMLElement {
  const wrapper = document.createElement('label');
  wrapper.className = 'input__checkbox-wrapper';
  wrapper.htmlFor = id;

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = id;
  input.className = 'input input__checkbox';
  input.checked = opts.checked ?? false;
  input.disabled = disabled;
  input.required = opts.required ?? false;
  input.addEventListener('change', () => onChange?.(input.checked));

  const box = document.createElement('span');
  box.className = 'input__checkbox-box';

  const labelText = opts.label ?? (opts as BaseInputOptions).label ?? '';

  wrapper.appendChild(input);
  wrapper.appendChild(box);
  if (labelText) {
    const span = document.createElement('span');
    span.className = 'input__checkbox-label';
    span.textContent = labelText;
    wrapper.appendChild(span);
  }

  return wrapper;
}

function checkboxInputHTML(opts: CheckboxInputOptions, id: string, disabled: boolean): string {
  const labelText = opts.label ?? '';
  return `
    <label class="input__checkbox-wrapper" for="${id}">
      <input type="checkbox" id="${id}" class="input input__checkbox" ${opts.checked ? 'checked' : ''} ${disabled ? 'disabled' : ''} ${opts.required ? 'required' : ''} />
      <span class="input__checkbox-box"></span>
      ${labelText ? `<span class="input__checkbox-label">${escapeHTML(labelText)}</span>` : ''}
    </label>
  `;
}

function createSliderInput(opts: SliderInputOptions, id: string, disabled: boolean, onChange?: (v: number) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'input__slider-wrapper';

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.className = 'input input__slider';
  input.min = String(opts.min ?? 0);
  input.max = String(opts.max ?? 100);
  input.step = String(opts.step ?? 1);
  input.value = String(opts.value ?? opts.min ?? 0);
  input.disabled = disabled;
  input.addEventListener('input', () => onChange?.(Number(input.value)));

  wrapper.appendChild(input);

  if (opts.showValue !== false) {
    const valueDisplay = document.createElement('output');
    valueDisplay.className = 'input__slider-value';
    valueDisplay.textContent = input.value;
    valueDisplay.setAttribute('for', id);
    input.addEventListener('input', () => { valueDisplay.textContent = input.value; });
    wrapper.appendChild(valueDisplay);
  }

  return wrapper;
}

function sliderInputHTML(opts: SliderInputOptions, id: string, disabled: boolean): string {
  const showValue = opts.showValue !== false;
  return `
    <div class="input__slider-wrapper">
      <input type="range" id="${id}" class="input input__slider" min="${opts.min ?? 0}" max="${opts.max ?? 100}" step="${opts.step ?? 1}" value="${opts.value ?? opts.min ?? 0}" ${disabled ? 'disabled' : ''} />
      ${showValue ? `<output class="input__slider-value" for="${id}">${opts.value ?? opts.min ?? 0}</output>` : ''}
    </div>
  `;
}

function createColorInput(opts: ColorInputOptions, id: string, disabled: boolean, onChange?: (v: string) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'input__color-wrapper';

  const input = document.createElement('input');
  input.type = 'color';
  input.id = id;
  input.className = 'input input__color';
  input.value = opts.value ?? '#000000';
  input.disabled = disabled;
  input.addEventListener('input', () => onChange?.(input.value));

  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'input__color-swatch';
  swatch.style.backgroundColor = input.value;
  swatch.disabled = disabled;
  swatch.setAttribute('aria-label', 'Seleccionar color');
  input.addEventListener('input', () => { swatch.style.backgroundColor = input.value; });

  wrapper.appendChild(swatch);
  wrapper.appendChild(input);

  return wrapper;
}

function colorInputHTML(opts: ColorInputOptions, id: string, disabled: boolean): string {
  return `
    <div class="input__color-wrapper">
      <button type="button" class="input__color-swatch" style="background-color:${escapeHTML(opts.value ?? '#000000')}" ${disabled ? 'disabled' : ''} aria-label="Seleccionar color"></button>
      <input type="color" id="${id}" class="input input__color" value="${escapeHTML(opts.value ?? '#000000')}" ${disabled ? 'disabled' : ''} />
    </div>
  `;
}

function createFileInput(opts: FileInputOptions, id: string, disabled: boolean, onChange?: (v: FileList | null) => void): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = `input__file-wrapper ${opts.dropZone ? 'input__file-wrapper--dropzone' : ''}`;

  const input = document.createElement('input');
  input.type = 'file';
  input.id = id;
  input.className = 'input input__file';
  input.disabled = disabled;
  input.multiple = opts.multiple ?? false;
  if (opts.accept) input.accept = opts.accept;
  input.addEventListener('change', () => onChange?.(input.files));

  if (opts.dropZone) {
    wrapper.addEventListener('dragover', (e) => { e.preventDefault(); wrapper.classList.add('input__file-wrapper--dragover'); });
    wrapper.addEventListener('dragleave', () => wrapper.classList.remove('input__file-wrapper--dragover'));
    wrapper.addEventListener('drop', (e) => {
      e.preventDefault();
      wrapper.classList.remove('input__file-wrapper--dragover');
      if (e.dataTransfer?.files.length) {
        input.files = e.dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  const label = document.createElement('label');
  label.htmlFor = id;
  label.className = 'input__file-label';
  label.innerHTML = `
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
    <span>${escapeHTML(opts.dropZone ? 'Arrastrar archivo aquí o clic para seleccionar' : 'Seleccionar archivo')}</span>
  `;

  wrapper.appendChild(input);
  wrapper.appendChild(label);

  return wrapper;
}

function fileInputHTML(opts: FileInputOptions, id: string, disabled: boolean): string {
  const dropZoneClass = opts.dropZone ? 'input__file-wrapper--dropzone' : '';
  return `
    <div class="input__file-wrapper ${dropZoneClass}">
      <input type="file" id="${id}" class="input input__file" ${disabled ? 'disabled' : ''} ${opts.multiple ? 'multiple' : ''} ${opts.accept ? `accept="${escapeHTML(opts.accept)}"` : ''} />
      <label for="${id}" class="input__file-label">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span>${escapeHTML(opts.dropZone ? 'Arrastrar archivo aquí o clic para seleccionar' : 'Seleccionar archivo')}</span>
      </label>
    </div>
  `;
}

// ============================================================================
// UTILIDADES
// ============================================================================



// ============================================================================
// CSS
// ============================================================================

