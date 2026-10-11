import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// Booky is built into ONE self-contained HTML file (fonts, dictionary and all
// libraries inlined) so it can be opened straight from disk with no internet.
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@dict': path.resolve(import.meta.dirname, 'node_modules/dictionary-en'),
      '@paged': path.resolve(import.meta.dirname, 'node_modules/pagedjs/dist'),
    },
  },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  worker: { format: 'iife' }, // classic workers also run from file://
  server: { open: '/app.html' },
  build: {
    rollupOptions: { input: 'app.html' }, // index.html at the root is the GitHub Pages landing page
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000,
    cssCodeSplit: false,
  },
});
