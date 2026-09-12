import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 24925,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4325'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
});
