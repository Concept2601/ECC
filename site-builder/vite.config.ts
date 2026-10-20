import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = `http://localhost:${process.env.PORT ?? 8787}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': API, '/sites': API },
  },
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node' },
});
