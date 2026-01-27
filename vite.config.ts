import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/v1': {
        target: 'https://dev.api.middleware.koneksi.com.do',
        changeOrigin: true,
        secure: false, // In case of self-signed certs, though likelihood is low on public dev api
      }
    }
  }
})
