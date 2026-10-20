import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const HOSTS_LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function esConexionLoopback(direccion) {
  if (typeof direccion !== 'string') return false;
  const normalizada = direccion.toLowerCase().replace(/^::ffff:/, '');
  return normalizada === '127.0.0.1' || normalizada === '::1';
}

export function crearGuardiaViteLoopback() {
  return {
    name: 'genares-solo-loopback',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (esConexionLoopback(request.socket?.remoteAddress)) return next();
        response.statusCode = 403;
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.end('El servidor local de Genares solo acepta conexiones loopback.');
      });
    },
  };
}

export function validarDestinoApiLocal(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    throw new Error('VITE_API_PROXY_TARGET debe ser una URL HTTP local.');
  }
  const host = url.hostname.toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || !HOSTS_LOOPBACK.has(host)) {
    throw new Error('El proxy de desarrollo solo puede apuntar a un backend loopback.');
  }
  return url.toString().replace(/\/$/, '');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const destinoApi = validarDestinoApiLocal(env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:3001');
  return {
    plugins: [react(), crearGuardiaViteLoopback()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      cors: false,
      proxy: {
        '/api': {
          target: destinoApi,
          changeOrigin: false,
        },
      },
    },
    preview: { host: '127.0.0.1', port: 4173 },
  };
});
