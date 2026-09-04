/**
 * Icon.ts — Iconos Lucide SVG inline
 * Todos los iconos son SVG inline, 16x16 o 20x20, currentColor.
 */

// Mapeo de nombres a paths SVG de Lucide (subset optimizado)
const ICON_PATHS: Record<string, string> = {
  // Archivo
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
  folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M14 9l-5-5-5 5M12 3v12',
  trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',

  // Edición
  undo: 'M3 7v6h6M3 13a9 9 0 1 0 2.7-6.3L3 7',
  redo: 'M21 7v6h-6M21 13a9 9 0 1 1-2.7-6.3L21 7',
  copy: 'M16 1H4a2 2 0 0 0-2 2v14h2M8 1H8a2 2 0 0 1 2 2v2M16 1h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2',
  paste: 'M9 9H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h4M15 15h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-4v4a2 2 0 0 1-2 2',
  cut: 'M6 3h12M6 3v12M18 3v12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',

  // Vistas
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 16a4 4 0 110-8 4 4 0 010 8z',
  'eye-off': 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11a18.5 18.5 0 01-2.16 7.12M1 1l22 22',
  maximize: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
  minimize: 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3',
  grid: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  list: 'M3 12h18M3 6h18M3 18h18',
  layout: 'M3 3h18v18H3zM12 3v18M3 12h18',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',

  // Herramientas
  move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l3 3-3 3M19 9l3 3-3 3M2 12h20M12 2v20',
  rotate: 'M23 4v6M1 18v6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
  scale: 'M3 3h6v6M21 3h-6v6M3 21v-6h6M21 21h-6v-6',
  cursor: 'M13.5 21.5a.5.5 0 01-.5-.5V13a1 1 0 011-1h4a1 1 0 011 1v8a.5.5 0 01-.5.5h-4a.5.5 0 01-.5-.5zM5 5l3.5 3.5M9.5 9.5l1.5 1.5M15 15l1.5 1.5',
  brush: 'M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 2a8 8 0 118 8 8 8 0 01-8-8z',
  code: 'M16 18l6-6-6-6M8 6l-6 6 6 6',
  terminal: 'M4 17l6-6-6-6M12 19h8',
  settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM21 10.22V9.78a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2zm-8 10h.44a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2zm-10 0h.44a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2z',

  // Estado
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  info: 'M13 16h-2v-4h2M13 12h-2v-2h2M12 2a10 10 0 100 20 10 10 0 000-20z',
  loader: 'M21 12a9 9 0 11-6.219-8.56',
  cpu: 'M12 2a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2h-4a2 2 0 00-2-2zM12 16a2 2 0 01-2-2v-2a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2z',
  globe: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM12 12a3 3 0 100-6 3 3 0 000 6z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100 8 4 4 0 000-8z',

  // Navegación
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-up': 'M18 15l-6-6-6 6',
  'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  'arrow-up': 'M12 19V5M5 12l7-7 7 7',
  'arrow-down': 'M12 5v14M19 12l-7 7-7-7',

  // Media
  play: 'M5 3l14 9-14 9z',
  pause: 'M6 4h4v16H6zm8 0h4v16h-4z',
  stop: 'M6 4h16v16H6z',
  'skip-forward': 'M6 4v16l10-8zM19 4v16',
  'volume-2': 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a7 7 0 010 12.14M15.54 8.46a3 3 0 010 4.24',
  'volume-x': 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a7 7 0 010 12.14M15.54 8.46a3 3 0 010 4.24',
};

/**
 * Crea un elemento SVG para el icono dado.
 * @param name Nombre del icono (clave de ICON_PATHS)
 * @param size Tamaño en px (default 16)
 * @returns SVGElement
 */
export function createIcon(name: string, size: number = 16): SVGSVGElement {
  const path = ICON_PATHS[name];
  if (!path) {
    console.warn(`Icon "${name}" not found, using "alert-triangle"`);
    return createIcon('alert-triangle', size);
  }

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.style.flex = 'none';
  svg.style.display = 'block';

  const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathEl.setAttribute('d', path);
  svg.appendChild(pathEl);

  return svg;
}

/**
 * Renderiza un icono como string HTML (para uso en innerHTML).
 */
export function iconHTML(name: string, size: number = 16): string {
  const path = ICON_PATHS[name] || ICON_PATHS['alert-triangle'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block"><path d="${path}"></path></svg>`;
}

/**
 * Lista de iconos disponibles.
 */
export function listIcons(): string[] {
  return Object.keys(ICON_PATHS).sort();
}