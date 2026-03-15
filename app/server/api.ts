/**
 * Vite Dev Server API Plugin
 *
 * Adds middleware to handle project management API endpoints.
 * Uses the engine's project.ts and loader.ts functions (Node.js) to
 * perform file-system operations that the browser can't do directly.
 */

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createProject, saveStory, deleteProject, duplicateProject, type CreateProjectOptions } from '../../src/engine/project.js';
import { discoverGames, loadGame } from '../../src/engine/loader.js';
import { exportGame, exportGameSingleFile, exportGameJSON, isPlayerBuilt } from './export.js';
import { exportGameDesktop } from './tauri-export.js';
import { exportGameCli } from './export-cli.js';

const GAMES_DIR = path.resolve(import.meta.dirname, '../../games');

/**
 * Parse JSON body from an incoming request.
 */
function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send a JSON response.
 */
function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Vite plugin that adds API routes for project management.
 */
export function apiPlugin(): Plugin {
  return {
    name: 'michelangelo-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';

        // ── GET /api/projects — Discover all projects ──
        if (req.method === 'GET' && url === '/api/projects') {
          try {
            const games = await discoverGames(GAMES_DIR);
            const result = games.map((g) => ({
              id: path.basename(g.path),
              path: `/${path.basename(g.path)}`,
              manifest: g.manifest,
            }));
            sendJson(res, 200, result);
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        // ── POST /api/projects — Create a new project ──
        if (req.method === 'POST' && url === '/api/projects') {
          try {
            const body = await parseBody(req) as CreateProjectOptions;
            if (!body.title || typeof body.title !== 'string') {
              sendJson(res, 400, { error: 'title is required' });
              return;
            }
            const result = await createProject(GAMES_DIR, body);
            sendJson(res, 201, {
              id: result.id,
              path: `/${result.id}`,
              story: result.story,
            });
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        // ── POST /api/projects/:id/save — Save a project ──
        const saveMatch = url.match(/^\/api\/projects\/([^/]+)\/save$/);
        if (req.method === 'POST' && saveMatch) {
          try {
            const projectId = decodeURIComponent(saveMatch[1]!);
            const projectPath = path.join(GAMES_DIR, projectId);
            const body = await parseBody(req);
            await saveStory(projectPath, body);
            sendJson(res, 200, { ok: true });
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        // ── POST /api/projects/:id/export — Export game as standalone SPA ──
        const exportMatch = url.match(/^\/api\/projects\/([^/]+)\/export$/);
        if (req.method === 'POST' && exportMatch) {
          try {
            const projectId = decodeURIComponent(exportMatch[1]!);
            const body = await parseBody(req) as { story: any; format?: 'folder' | 'single-file' | 'desktop' | 'json' | 'cli'; outputPath?: string };

            if (!body.story) {
              sendJson(res, 400, { error: 'story data is required in the request body' });
              return;
            }

            // Use custom output path if provided, otherwise default to exports/
            const baseDir = body.outputPath
              ? path.resolve(body.outputPath)
              : path.resolve(GAMES_DIR, '..', 'exports');
            const projectRoot = path.resolve(GAMES_DIR, '..');
            const title = body.story.manifest?.title || projectId;
            const safeName = title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

            if (body.format === 'json') {
              const outputPath = path.join(baseDir, `${safeName}.json`);
              await exportGameJSON({ story: body.story, outputPath });
              sendJson(res, 200, {
                ok: true,
                format: 'json',
                outputPath: body.outputPath ? outputPath : path.relative(projectRoot, outputPath),
              });
            } else if (body.format === 'cli') {
              const outputPath = path.join(baseDir, `${safeName}-cli.js`);
              await exportGameCli({ story: body.story, outputPath });
              sendJson(res, 200, {
                ok: true,
                format: 'cli',
                outputPath: body.outputPath ? outputPath : path.relative(projectRoot, outputPath),
              });
            } else if (!isPlayerBuilt()) {
              sendJson(res, 500, {
                error: 'Player bundle not built. Run: cd app && npx vite build --config vite.player.config.ts'
              });
              return;
            } else if (body.format === 'desktop') {
              const outputDir = path.join(baseDir, `${safeName}-desktop`);
              await exportGameDesktop({ story: body.story, outputDir });
              sendJson(res, 200, {
                ok: true,
                format: 'desktop',
                outputPath: body.outputPath ? outputDir : path.relative(projectRoot, outputDir),
              });
            } else if (body.format === 'single-file') {
              const outputPath = path.join(baseDir, `${safeName}.html`);
              await exportGameSingleFile({ story: body.story, outputPath });
              sendJson(res, 200, {
                ok: true,
                format: 'single-file',
                outputPath: body.outputPath ? outputPath : path.relative(projectRoot, outputPath),
              });
            } else {
              const outputDir = path.join(baseDir, safeName);
              await exportGame({ story: body.story, outputDir });
              sendJson(res, 200, {
                ok: true,
                format: 'folder',
                outputPath: body.outputPath ? outputDir : path.relative(projectRoot, outputDir),
              });
            }
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        // ── DELETE /api/projects/:id — Delete a project ──
        const deleteMatch = url.match(/^\/api\/projects\/([^/]+)$/);
        if (req.method === 'DELETE' && deleteMatch) {
          try {
            const projectId = decodeURIComponent(deleteMatch[1]!);
            const projectPath = path.join(GAMES_DIR, projectId);
            if (!fs.existsSync(projectPath)) {
              sendJson(res, 404, { error: 'Project not found' });
              return;
            }
            const ok = await deleteProject(projectPath);
            if (ok) {
              sendJson(res, 200, { ok: true });
            } else {
              sendJson(res, 500, { error: 'Failed to delete project' });
            }
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        // ── POST /api/projects/:id/duplicate — Duplicate a project ──
        const dupMatch = url.match(/^\/api\/projects\/([^/]+)\/duplicate$/);
        if (req.method === 'POST' && dupMatch) {
          try {
            const projectId = decodeURIComponent(dupMatch[1]!);
            const projectPath = path.join(GAMES_DIR, projectId);
            if (!fs.existsSync(projectPath)) {
              sendJson(res, 404, { error: 'Project not found' });
              return;
            }
            const body = await parseBody(req) as { title?: string };
            const newTitle = body.title || `${projectId} (Copy)`;
            const result = await duplicateProject(projectPath, GAMES_DIR, newTitle);
            sendJson(res, 201, {
              id: result.id,
              path: `/${result.id}`,
              story: result.story,
            });
          } catch (err) {
            sendJson(res, 500, { error: String(err) });
          }
          return;
        }

        next();
      });
    },
  };
}
