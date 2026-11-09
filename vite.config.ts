import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createDineInServerPlugin } from './src/server/dineInServerPlugin.ts'

export default defineConfig({
  plugins: [react(), createDineInServerPlugin()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    allowedHosts: [
      'very-fibre-broadcasting-tue.trycloudflare.com',
      '.trycloudflare.com',
    ]
  }
})