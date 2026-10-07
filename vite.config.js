import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Sem CORS: em dev, o back-end (server/, porta 4000) fica atrás do
    // mesmo host:porta do Vite — tanto o app React quanto public/admin.html
    // (servido como estático pelo próprio Vite) chamam /api e /socket.io
    // com URL relativa e caem aqui.
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', ws: true, changeOrigin: true },
    },
  },
})
