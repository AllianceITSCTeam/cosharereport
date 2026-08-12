import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  // Load .env from monorepo root (DEV/) so VITE_* vars defined there are picked up
  envDir: path.resolve(__dirname, '../..'),
  // Shared static assets (logo, favicon) live at the monorepo root's public/ dir
  publicDir: path.resolve(__dirname, '../../public'),
  define: {
    __BUILD_TIME__: JSON.stringify(
      command === 'build' ? new Date().toISOString() : 'dev',
    ),
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    port: 5390,
    strictPort: true,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}));
