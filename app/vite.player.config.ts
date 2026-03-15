/**
 * Vite config for building the standalone game player.
 *
 * Produces a self-contained bundle (JS + CSS) that can be embedded
 * in an exported game HTML file. No server dependencies — the story
 * data is injected at export time via window.__STORY_DATA__.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'player'),
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../src'),
    },
  },
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist-player'),
    emptyOutDir: true,
  },
});
