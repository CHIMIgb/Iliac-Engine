import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'node:fs';
import { resolveAssetPath } from './src/io/assetServer';

/**
 * Middleware de assets locales del Studio.
 *
 * C5c: la subida de assets ya NO pasa por el dev server (vive en la API del
 * backend: `POST /api/assets` con sesión). Aquí solo queda el servido estático
 * de la carpeta `assets/` del repositorio:
 *
 *   GET /assets/<subruta> → sirve el archivo (proyectos antiguos que guardan
 *                           rutas locales `/assets/audio/...`, `/assets/sprites/...`)
 *
 * La validación anti-traversal vive en `src/io/assetServer.ts` (pura, testeada);
 * aquí solo se conecta a fs y a la respuesta HTTP.
 */
function assetsMiddleware() {
  const assetsDir = resolve(__dirname, '..', 'assets');
  const json = (res: import('node:http').ServerResponse, code: number, body: unknown): void => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };

  return {
    name: 'studio-assets',
    configureServer(server: import('vite').ViteDevServer): void {
      // Sin mount path: connect recortaria req.url y romperia la ruta completa
      // /assets/... (logico del middleware). Con use() plano req.url es la URL
      // entera y la rama compara contra ella.
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];

        // GET /assets/<subruta> — sirve el archivo local (proyectos antiguos).
        if (req.method === 'GET' && url.startsWith('/assets/')) {
          const rel = resolveAssetPath(url);
          if (!rel) return json(res, 400, { success: false, error: 'Ruta no permitida' });
          const file = resolve(assetsDir, rel);
          if (!file.startsWith(assetsDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
            return json(res, 404, { success: false, error: 'No existe' });
          }
          fs.createReadStream(file).pipe(res);
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@engine': resolve(__dirname, '../engine'),
    },
    dedupe: ['three'],
  },
  plugins: [assetsMiddleware()],
  server: {
    port: 5173,
    open: '/studio/',
    proxy: {
      // C5a: el Studio habla con el backend en same-origin (sin CORS en dev);
      // /auth y /api viven en el proceso del server (puerto 3000).
      '/api': 'http://127.0.0.1:3000',
      '/auth': 'http://127.0.0.1:3000',
    },
    fs: {
      // Permitir al middleware y a los modulos leer fuera de studio/ (motor, assets/).
      allow: [resolve(__dirname, '..'), resolve(__dirname, '..', 'assets')],
    },
  },
  test: {
    environment: 'node',
  },
});