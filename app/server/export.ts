/**
 * Game Export Module
 *
 * Takes a Story object and produces a self-contained SPA by:
 * 1. Reading the pre-built player shell (dist-player/)
 * 2. Injecting the story data as a JSON blob in a <script> tag
 * 3. Replacing the page title with the game title
 * 4. Writing everything to an output directory
 *
 * The result is a folder that can be served from any static host,
 * opened as a local file, or wrapped in Tauri for desktop distribution.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { Story } from '../../src/types/index.js';

const PLAYER_DIST = path.resolve(import.meta.dirname, '../dist-player');

/**
 * Check whether the pre-built player bundle exists.
 */
export function isPlayerBuilt(): boolean {
  return fs.existsSync(path.join(PLAYER_DIST, 'index.html'));
}

export interface ExportOptions {
  /** The complete story data to embed */
  story: Story;
  /** Output directory path */
  outputDir: string;
}

/**
 * Export a game as a self-contained SPA.
 *
 * Copies the pre-built player shell and injects the story data.
 * The output directory will contain:
 *   index.html  — with embedded story data + title
 *   assets/     — JS and CSS bundles
 */
export async function exportGame(options: ExportOptions): Promise<void> {
  const { story, outputDir } = options;

  if (!isPlayerBuilt()) {
    throw new Error(
      'Player bundle not found. Run "npx vite build --config vite.player.config.ts" first.'
    );
  }

  // Read the player HTML template
  let html = fs.readFileSync(path.join(PLAYER_DIST, 'index.html'), 'utf-8');

  // Inject game title
  const title = story.manifest.title || 'Untitled Game';
  html = html.replace('<!-- GAME_TITLE -->', escapeHtml(title));

  // Inject story data as a script tag before the closing </head>
  const storyJson = JSON.stringify(story);
  const storyScript = `<script>window.__STORY_DATA__=${storyJson};</script>`;
  html = html.replace('</head>', `  ${storyScript}\n  </head>`);

  // Create output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Write the modified HTML
  fs.writeFileSync(path.join(outputDir, 'index.html'), html, 'utf-8');

  // Copy the assets directory
  const assetsDir = path.join(PLAYER_DIST, 'assets');
  if (fs.existsSync(assetsDir)) {
    const outAssetsDir = path.join(outputDir, 'assets');
    fs.mkdirSync(outAssetsDir, { recursive: true });

    for (const file of fs.readdirSync(assetsDir)) {
      fs.copyFileSync(
        path.join(assetsDir, file),
        path.join(outAssetsDir, file)
      );
    }
  }
}

/**
 * Export a game as a single self-contained HTML file.
 *
 * Inlines all JS and CSS into the HTML so the entire game is one file.
 * Useful for maximum portability (email, itch.io single-file uploads, etc.)
 */
export async function exportGameSingleFile(options: Omit<ExportOptions, 'outputDir'> & { outputPath: string }): Promise<void> {
  const { story, outputPath } = options;

  if (!isPlayerBuilt()) {
    throw new Error(
      'Player bundle not found. Run "npx vite build --config vite.player.config.ts" first.'
    );
  }

  let html = fs.readFileSync(path.join(PLAYER_DIST, 'index.html'), 'utf-8');

  // Inject game title
  const title = story.manifest.title || 'Untitled Game';
  html = html.replace('<!-- GAME_TITLE -->', escapeHtml(title));

  // Inject story data
  const storyJson = JSON.stringify(story);
  const storyScript = `<script>window.__STORY_DATA__=${storyJson};</script>`;
  html = html.replace('</head>', `  ${storyScript}\n  </head>`);

  // Inline CSS: replace <link> tags with <style> blocks
  const assetsDir = path.join(PLAYER_DIST, 'assets');
  html = html.replace(
    /<link\s+rel="stylesheet"[^>]*href="\.\/assets\/([^"]+)"[^>]*>/g,
    (_match, filename) => {
      const cssPath = path.join(assetsDir, filename);
      if (fs.existsSync(cssPath)) {
        const css = fs.readFileSync(cssPath, 'utf-8');
        return `<style>${css}</style>`;
      }
      return _match;
    }
  );

  // Inline JS: replace <script> tags with inline scripts
  html = html.replace(
    /<script\s+type="module"[^>]*src="\.\/assets\/([^"]+)"[^>]*><\/script>/g,
    (_match, filename) => {
      const jsPath = path.join(assetsDir, filename);
      if (fs.existsSync(jsPath)) {
        const js = fs.readFileSync(jsPath, 'utf-8');
        return `<script type="module">${js}</script>`;
      }
      return _match;
    }
  );

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf-8');
}

/**
 * Export the raw Story object as a portable JSON file.
 *
 * Unlike the SPA exports this doesn't require a pre-built player bundle —
 * it simply writes the story data to a .json file.
 */
export async function exportGameJSON(options: { story: Story; outputPath: string }): Promise<void> {
  const { story, outputPath } = options;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(story, null, 2), 'utf-8');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
