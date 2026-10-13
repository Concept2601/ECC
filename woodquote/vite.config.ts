import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' so the bundle works from file:// inside the Android WebView
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 2500 },
})
