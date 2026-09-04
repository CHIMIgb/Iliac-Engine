/**
 * Icon — SVG inline 16x16 (Lucide subset).
 * Cada icono es un path SVG embebido. color = currentColor.
 */

type IconName =
  | 'cursor'
  | 'box'
  | 'grid-3x3'
  | 'move'
  | 'ruler'
  | 'person-standing'
  | 'save'
  | 'download'
  | 'upload'
  | 'play'
  | 'undo'
  | 'redo'
  | 'panel-right'
  | 'plus'
  | 'trash-2'
  | 'chevron-down'
  | 'chevron-right'
  | 'layers'
  | 'map'
  | 'eye'
  | 'info'
  | 'check'
  | 'x';

const PATHS: Record<IconName, string> = {
  'cursor':
    'M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z',
  'box':
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z M3.27 6.96 12 12.01l8.73-5.05 M12 22.08V12',
  'grid-3x3':
    'M2 2h4v4H2zM10 2h4v4h-4zM18 2h4v4h-4zM2 10h4v4H2zM10 10h4v4h-4zM18 10h4v4h-4zM2 18h4v4H2zM10 18h4v4h-4zM18 18h4v4h-4z',
  'move':
    'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20',
  'ruler':
    'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z',
  'person-standing':
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M9 15l2 2 4-4',
  'save':
    'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7 M7 3v4a1 1 0 0 0 1 1h7',
  'download':
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  'upload':
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  'play':
    'M6 3l14 9-14 9V3z',
  'undo':
    'M3 7v6h6 M3 13a9 9 0 1 0 2.6-6.4L3 7',
  'redo':
    'M21 7v6h-6 M21 13a9 9 0 1 1-2.6-6.4L21 7',
  'panel-right':
    'M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18',
  'plus':
    'M12 5v14M5 12h14',
  'trash-2':
    'M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6 M10 11v6 M14 11v6',
  'chevron-down':
    'M6 9l6 6 6-6',
  'chevron-right':
    'M9 18l6-6-6-6',
  'layers':
    'M12 2 2 7l10 5 10-5-10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  'map':
    'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z M9 4v13 M15 7v13',
  'eye':
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'info':
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M12 16v-4 M12 8h.01',
  'check':
    'M20 6 9 17l-5-5',
  'x':
    'M18 6 6 18 M6 6l12 12',
};

export function Icon(name: IconName, size = 16): SVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', PATHS[name]);
  svg.appendChild(path);

  return svg;
}
