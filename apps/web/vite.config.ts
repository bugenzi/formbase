import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // pdfjs-dist 4.x uses top-level await which Vite needs to handle
    exclude: ['pdfjs-dist'],
  },
})
