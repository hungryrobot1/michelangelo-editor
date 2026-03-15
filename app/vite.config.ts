import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { apiPlugin } from './server/api.js';

/**
 * Serve the games/ directory as static assets in dev mode.
 * This replaces the old publicDir override so that public/ (PWA assets) works too.
 */
function serveGamesPlugin(): Plugin {
  const gamesDir = path.resolve(__dirname, '../games');
  return {
    name: 'serve-games',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next();
        const filePath = path.join(gamesDir, decodeURIComponent(req.url));
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Content-Type', 'application/json');
          fs.createReadStream(filePath).pipe(res);
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // Use relative paths in production so the build works under any subpath
  base: command === 'build' ? './' : '/',
  build: {
    outDir: path.resolve(__dirname, '../docs/editor'),
    emptyOutDir: true,
  },
  plugins: [react(), apiPlugin(), serveGamesPlugin()],
  resolve: {
    alias: {
      '@engine': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    fs: {
      // Allow serving files from the parent directory (engine source + game data)
      allow: ['..'],
    },
  },
}));
