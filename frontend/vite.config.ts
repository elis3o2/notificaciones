import { defineConfig } from 'vite';

export default defineConfig({
  base: '/turnos/',
    build: {
      outDir: 'turnos/dist'
    },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['salud1.dyndns.org'],
    hmr: {
      protocol: 'wss',
      host: 'salud1.dyndns.org',
      clientPort: 443,
      path: '/turnos/@vite/client'  // importante
    }
  },
  plugins: [
    {
      name: 'prefix-dev-absolute-urls',
      transformIndexHtml(html) {
        // reescribe las URLs en el index que comienzan con "/" para anteponer /turnos
        return html.replace(/(href|src)=["']\/(?!turnos\/)([^"']+)["']/g, (_, a, b) => {
          return `${a}="/turnos/${b}"`;
        });
      }
    }
  ]
});