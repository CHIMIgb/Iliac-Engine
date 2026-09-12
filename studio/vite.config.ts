import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': resolve(__dirname, '../engine'),
    },
    // three existe dos veces (raíz para el motor, studio para Vite): dedupe
    // evita "Multiple instances of Three.js being imported".
    dedupe: ['three'],
  },
  server: {
    port: 5173,
    open: '/studio/',
  },
  test: {
    environment: 'node',
  },
});
