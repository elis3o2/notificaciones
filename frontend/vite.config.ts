import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// vite.config.js
export default defineConfig({
  base: '/turnos/',
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  // 👇 Añade esta sección
  server: {
    host: '0.0.0.0', // Esto permite que el servidor sea accesible externamente
    port: 5173      // Opcional: especifica un puerto, el predeterminado es 5173
  }
});