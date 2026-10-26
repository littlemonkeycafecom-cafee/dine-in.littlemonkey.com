import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createDineInServerPlugin } from './src/server/dineInServerPlugin';

export default defineConfig({
  plugins: [react(), createDineInServerPlugin()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
  },
});
