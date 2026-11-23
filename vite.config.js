import { defineConfig } from 'vite';

export default defineConfig({
  root: 'game',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
          if (id.includes('/node_modules/@dimforge/rapier3d-compat/')) return 'rapier';
        },
      },
    },
  },
  server: { host: '127.0.0.1' },
});
