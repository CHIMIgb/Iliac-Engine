import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@engine': resolve(__dirname, '../engine'),
    },
  },
  server: {
    port: 5173,
    open: '/studio/',
  },
  test: {
    environment: 'node',
  },
});
