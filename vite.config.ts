import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
    watch: {
      // The Flask backend writes runtime state files into backend/ (discount
      // offers, approved keys, demand statuses). Watching them made every
      // discount approve/dismiss/cancel trigger a full Vite page reload.
      ignored: ['**/backend/**'],
    },
  },
})
