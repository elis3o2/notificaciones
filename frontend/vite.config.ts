import { defineConfig } from 'vite';

export default defineConfig({
  base: '/turnos/',           // <-- importante: slashes al inicio y final
  build: {
    outDir: 'dist/turnos'     // <-- ahora coincide con serve.cjs (DIST + 'turnos')
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['salud1.dyndns.org'],
    hmr: {
      protocol: 'wss',
      host: 'salud1.dyndns.org',
      clientPort: 443,
      path: '/turnos/@vite/client'
    }
  },
});
