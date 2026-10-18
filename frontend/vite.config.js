import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(process.env.VITE_TURNSTILE_SITE_KEY || "0x4AAAAAACMO_7n8OQXZuB4g")
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    watch: {
      usePolling: true,
      interval: 1000,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'https://www.aurapayments.xyz',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
