import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'node:fs';
import {
  audioUploadToBuffer,
  isAudioName,
  resolveAssetPath,
} from './src/io/assetServer';

/**
 * Middleware de assets del Studio (F4.6.a): el navegador no puede escribir en
 * disco; el dev server hace de puente entre la herramienta de Audio y la
 * carpeta `assets/audio/` del repositorio.
 *
 *   POST /assets/audio/upload   → { name, data(base64) } → escribe en assets/audio/
 *   GET  /assets/audio/list     → { files: [...] } (solo extensiones de audio)
 *   GET  /assets/<subruta>      → sirve el archivo (playtest / preview)
 *
 * La logica de validacion vive en `src/io/assetServer.ts` (pura, testeada);
 * aqui solo se conecta a fs y a la respuesta HTTP.
 */
function assetsMiddleware() {
  const assetsDir = resolve(__dirname, '..', 'assets');
  const audioDir = resolve(assetsDir, 'audio');
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
      // entera y cada rama compara contra ella.
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '/').split('?')[0];

        // POST /assets/audio/upload — guarda un archivo subido desde el popover.
        if (req.method === 'POST' && url === '/assets/audio/upload') {
          let raw = '';
          req.on('data', (c) => {
            raw += c;
            if (raw.length > 60 * 1024 * 1024) req.destroy(); // protege el server
          });
          req.on('end', () => {
            let payload: { name?: unknown; data?: unknown };
            try {
              payload = JSON.parse(raw);
            } catch {
              return json(res, 400, { success: false, error: 'JSON invalido' });
            }
            const out = audioUploadToBuffer(payload);
            if (!out) {
              return json(res, 400, {
                success: false,
                error: 'Archivo invalido: nombre, formato de audio o tamano (>50 MB) incorrecto',
              });
            }
            const dest = resolve(audioDir, out.fileName);
            if (!dest.startsWith(audioDir)) {
              return json(res, 400, { success: false, error: 'Ruta fuera de assets/audio' });
            }
            fs.mkdirSync(audioDir, { recursive: true });
            fs.writeFileSync(dest, out.buffer);
            json(res, 200, { success: true, path: `/assets/audio/${out.fileName}` });
          });
          return;
        }

        // GET /assets/audio/list — lista los audios ya presentes (para el popover).
        if (req.method === 'GET' && url === '/assets/audio/list') {
          try {
            const files = fs
              .readdirSync(audioDir)
              .filter((f) => fs.statSync(resolve(audioDir, f)).isFile() && isAudioName(f))
              .sort();
            json(res, 200, { files });
          } catch {
            json(res, 200, { files: [] });
          }
          return;
        }

        // GET /assets/<subruta> — sirve el archivo (audio para preview/playtest).
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
    fs: {
      // Permitir al middleware y a los modulos leer fuera de studio/ (motor, assets/).
      allow: [resolve(__dirname, '..'), resolve(__dirname, '..', 'assets')],
    },
  },
  test: {
    environment: 'node',
  },
});