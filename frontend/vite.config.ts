import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const BACKEND = 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    port: 5173,
    proxy: {
      '/api': BACKEND,
      '/media': BACKEND,
      // Админка Django и её статика. Host не меняем — иначе CSRF при входе в админку не пройдёт
      '^/admin(/|$)': { target: BACKEND, changeOrigin: false },
      '/static': { target: BACKEND, changeOrigin: false },
    },
  },
})
