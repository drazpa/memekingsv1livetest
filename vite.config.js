import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'xrpl-vendor': ['xrpl'],
          'charts-vendor': ['lightweight-charts'],
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
})