/**
 * Icon — SVG inline usando la librería Lucide
 */

import { createElement, icons } from 'lucide';

export type IconName = keyof typeof icons;

const ALIASES: Record<string, string> = {
  'cursor': 'MousePointer2',
};

export function Icon(name: string, size = 16): SVGElement {
  const resolvedName = ALIASES[name] || name;
  const pascalName = resolvedName.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
  
  const iconNode = icons[pascalName as IconName];
  if (!iconNode) {
    console.warn(`Icon ${name} no encontrado en lucide.`);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', String(size));
    svg.setAttribute('height', String(size));
    return svg;
  }

  const svg = createElement(iconNode);
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  return svg;
}

