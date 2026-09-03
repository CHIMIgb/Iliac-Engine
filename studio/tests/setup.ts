/**
 * tests/setup.ts — Configuración global de Vitest
 */

import { vi } from 'vitest';

// Mock de matchMedia (usado por componentes que detectan dark mode, etc.)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock de ResizeObserver (usado por SplitView, etc.)
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock de IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock de requestAnimationFrame / cancelAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// Mock de HTMLDialogElement (para Modal)
if (typeof HTMLDialogElement === 'undefined') {
  (global as any).HTMLDialogElement = class HTMLDialogElement extends HTMLElement {
    open = false;
    returnValue = '';
    showModal() { this.open = true; }
    close() { this.open = false; }
  };
}

// Configurar console.error/warn para tests (opcional: silenciar ruido conocido)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = (...args) => {
    // Filtrar warnings conocidos de React/testing-library que no son errores reales
    if (args[0]?.includes?.('Warning:') || args[0]?.includes?.('act(...)')) {
      return;
    }
    originalError.apply(console, args);
  };
  console.warn = (...args) => {
    if (args[0]?.includes?.('Warning:')) return;
    originalWarn.apply(console, args);
  };
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Helper para esperar microtasks
export const waitFor = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

// Helper para renderizar componente y limpiar después
export function renderComponent<T extends HTMLElement>(createFn: () => T): { element: T; cleanup: () => void } {
  const element = createFn();
  document.body.appendChild(element);
  return {
    element,
    cleanup: () => {
      if (element.parentNode) element.parentNode.removeChild(element);
    },
  };
}

// Matchers personalizados
import { expect } from 'vitest';

expect.extend({
  toHaveClass(received: HTMLElement, className: string) {
    const pass = received.classList.contains(className);
    return {
      pass,
      message: () => pass
        ? `Expected element not to have class "${className}"`
        : `Expected element to have class "${className}"`,
    };
  },
  toBeVisible(received: HTMLElement) {
    const style = getComputedStyle(received);
    const pass = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    return {
      pass,
      message: () => pass
        ? 'Expected element not to be visible'
        : 'Expected element to be visible',
    };
  },
  toBeDisabled(received: HTMLElement) {
    const pass = received.hasAttribute('disabled') || (received as HTMLButtonElement).disabled === true;
    return {
      pass,
      message: () => pass
        ? 'Expected element not to be disabled'
        : 'Expected element to be disabled',
    };
  },
});

declare module 'vitest' {
  interface Assertion<T = any> {
    toHaveClass(className: string): void;
    toBeVisible(): void;
    toBeDisabled(): void;
  }
}