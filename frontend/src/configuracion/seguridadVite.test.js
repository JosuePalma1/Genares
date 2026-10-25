import { describe, expect, it, vi } from 'vitest';
import viteConfig, { esConexionLoopback, validarDestinoApiLocal } from '../../vite.config.js';

describe('aislamiento local de Vite', () => {
  it('acepta únicamente direcciones loopback', () => {
    expect(esConexionLoopback('127.0.0.1')).toBe(true);
    expect(esConexionLoopback('::1')).toBe(true);
    expect(esConexionLoopback('::ffff:127.0.0.1')).toBe(true);
    expect(esConexionLoopback('192.168.1.20')).toBe(false);
    expect(esConexionLoopback(undefined)).toBe(false);
  });

  it('deniega solicitudes remotas aun si Vite se inició con otro host', async () => {
    let middleware;
    const plugin = (await import('../../vite.config.js')).crearGuardiaViteLoopback();
    plugin.configureServer({ middlewares: { use: (handler) => { middleware = handler; } } });
    const response = {
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    const next = vi.fn();

    middleware({ socket: { remoteAddress: '192.168.1.20' } }, response, next);

    expect(response.statusCode).toBe(403);
    expect(response.end).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza destinos de proxy fuera de loopback', () => {
    expect(validarDestinoApiLocal('http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001');
    expect(validarDestinoApiLocal('http://localhost:3001')).toBe('http://localhost:3001');
    expect(() => validarDestinoApiLocal('https://api.example.org')).toThrow(/loopback/i);
  });

  it('mantiene la interfaz y el proxy en loopback sin CORS de desarrollo', () => {
    const config = viteConfig({ mode: 'development' });
    expect(config.server.host).toBe('127.0.0.1');
    expect(config.server.cors).toBe(false);
    expect(config.server.proxy['/api'].changeOrigin).toBe(false);
  });
});
