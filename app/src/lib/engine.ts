/**
 * Engine Browser Adapter
 *
 * Loads game data via HTTP fetch (since we can't use Node.js fs in the browser).
 * The Vite dev server serves game files from the games/ directory and provides
 * API endpoints for project management (create, save, discover).
 *
 * When no server is available (static/PWA deployment), all operations
 * fall back to client-side IndexedDB storage via storage.ts.
 *
 * All pure engine functions (editor CRUD, validation, conditions, effects)
 * are re-exported directly — they have no Node.js dependencies.
 */

import type {
  Story,
  StoryNode,
  GameManifest,
  Item,
  Ability,
  Trait,
  CompanionDefinition,
  AttributeDefinition,
  ResourceDefinition,
  CharacterCreationSchema,
  RegionComment,
} from '@engine/types/index.js';
import * as storage from './storage.js';

// Re-export all pure engine functions for browser use
export * from '@engine/engine/editor.js';
export * from '@engine/engine/appMode.js';
export {
  validateStory,
  validateNode,
  isStoryValid,
  getStoryErrors,
  generateNodeId,
  generatePrefixedId,
} from '@engine/engine/validation.js';
export { evaluateCondition, getAvailableChoices } from '@engine/engine/conditions.js';

// Re-export types
export type * from '@engine/types/index.js';

// Re-export storage utilities for direct use (import, download)
export { importFromJson, importFromFolder, downloadStoryAsJson } from './storage.js';

// =============================================================================
// Server detection — cached after first probe
// =============================================================================

let _serverAvailable: boolean | null = null;

async function isServerAvailable(): Promise<boolean> {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    const res = await fetch('/api/projects', { method: 'GET' });
    _serverAvailable = res.ok;
  } catch {
    _serverAvailable = false;
  }
  return _serverAvailable;
}

// =============================================================================
// Helpers
// =============================================================================

async function fetchOptionalJson<T>(url: string): Promise<T | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

function arrayToRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
  const record: Record<string, T> = {};
  for (const item of arr) {
    record[item.id] = item;
  }
  return record;
}

// =============================================================================
// Types
// =============================================================================

export interface GameInfo {
  id: string;
  path: string;
  manifest: GameManifest;
}

export interface CreateProjectOptions {
  title: string;
  author?: string;
  description?: string;
}

export interface CreateProjectResult {
  id: string;
  path: string;
  story: Story;
}

export interface DuplicateProjectResult {
  id: string;
  path: string;
  story: Story;
}

export type ExportFormat = 'folder' | 'single-file' | 'desktop' | 'json' | 'cli';

export interface ExportResult {
  ok: boolean;
  format: ExportFormat;
  outputPath: string;
}

// =============================================================================
// PROJECT DISCOVERY
// =============================================================================

export async function discoverGames(fallbackGameIds?: string[]): Promise<GameInfo[]> {
  if (await isServerAvailable()) {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) return (await res.json()) as GameInfo[];
    } catch { /* fall through */ }
  }

  // Static/PWA mode: use IndexedDB
  return storage.listProjects();
}

// =============================================================================
// PROJECT CREATION
// =============================================================================

export async function createProjectOnServer(
  options: CreateProjectOptions
): Promise<CreateProjectResult> {
  if (await isServerAvailable()) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to create project (${res.status})`);
    }
    return (await res.json()) as CreateProjectResult;
  }

  return storage.createProject(options);
}

// =============================================================================
// PROJECT SAVING
// =============================================================================

export async function saveStoryToServer(gameId: string, story: Story): Promise<void> {
  if (await isServerAvailable()) {
    const res = await fetch(`/api/projects/${encodeURIComponent(gameId)}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(story),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to save project (${res.status})`);
    }
    return;
  }

  await storage.saveProject(gameId, story);
}

// =============================================================================
// PROJECT DELETION
// =============================================================================

export async function deleteProjectOnServer(gameId: string): Promise<void> {
  if (await isServerAvailable()) {
    const res = await fetch(`/api/projects/${encodeURIComponent(gameId)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to delete project (${res.status})`);
    }
    return;
  }

  await storage.deleteProject(gameId);
}

// =============================================================================
// PROJECT DUPLICATION
// =============================================================================

export async function duplicateProjectOnServer(
  gameId: string,
  newTitle: string
): Promise<DuplicateProjectResult> {
  if (await isServerAvailable()) {
    const res = await fetch(`/api/projects/${encodeURIComponent(gameId)}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to duplicate project (${res.status})`);
    }
    return (await res.json()) as DuplicateProjectResult;
  }

  return storage.duplicateProject(gameId, newTitle);
}

// =============================================================================
// GAME EXPORT
// =============================================================================

export async function exportGame(
  gameId: string,
  story: Story,
  format: ExportFormat = 'folder',
  outputPath?: string
): Promise<ExportResult> {
  if (await isServerAvailable()) {
    const res = await fetch(`/api/projects/${encodeURIComponent(gameId)}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ story, format, outputPath: outputPath || undefined }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(err.error || `Failed to export game (${res.status})`);
    }
    return (await res.json()) as ExportResult;
  }

  // In static mode, "json" export is just a browser download
  if (format === 'json') {
    storage.downloadStoryAsJson(story);
    return { ok: true, format: 'json', outputPath: `${story.manifest.id}.michelangelo.json` };
  }

  throw new Error(
    `Export format "${format}" requires the development server. ` +
    `In the browser, use "Download Project" to save as JSON.`
  );
}

// =============================================================================
// GAME LOADING
// =============================================================================

/**
 * Loads a complete game. If the path is an IndexedDB reference (idb://),
 * loads from local storage. Otherwise fetches from the server.
 */
export async function loadGameFromServer(gamePath: string): Promise<Story> {
  // IndexedDB path
  if (gamePath.startsWith('idb://')) {
    const id = gamePath.slice('idb://'.length);
    return storage.getProject(id);
  }

  // Server/static file path
  const manifestRes = await fetch(`${gamePath}/game.json`);
  if (!manifestRes.ok) throw new Error(`Failed to load game manifest from ${gamePath}`);
  const manifest = (await manifestRes.json()) as GameManifest;

  const storyRes = await fetch(`${gamePath}/story.json`);
  if (!storyRes.ok) throw new Error(`Failed to load story from ${gamePath}`);
  const rawNodes = (await storyRes.json()) as any[];
  const nodesArray = rawNodes.map((n) => {
    if (!n.type) {
      return { ...n, type: 'dialogue', choices: n.choices ?? [] };
    }
    return n;
  }) as StoryNode[];
  const nodes = arrayToRecord(nodesArray);

  const attributesArray = await fetchOptionalJson<AttributeDefinition[]>(`${gamePath}/attributes.json`);
  const resourcesArray = await fetchOptionalJson<ResourceDefinition[]>(`${gamePath}/resources.json`);

  if (!attributesArray) throw new Error(`Game is missing attributes.json`);
  if (!resourcesArray) throw new Error(`Game is missing resources.json`);

  const [characterCreation, itemsArray, abilitiesArray, traitsArray, companionsArray, regionComments] =
    await Promise.all([
      fetchOptionalJson<CharacterCreationSchema>(`${gamePath}/character-creation.json`),
      fetchOptionalJson<Item[]>(`${gamePath}/items.json`),
      fetchOptionalJson<Ability[]>(`${gamePath}/abilities.json`),
      fetchOptionalJson<Trait[]>(`${gamePath}/traits.json`),
      fetchOptionalJson<CompanionDefinition[]>(`${gamePath}/companions.json`),
      fetchOptionalJson<RegionComment[]>(`${gamePath}/region-comments.json`),
    ]);

  return {
    manifest,
    nodes,
    attributes: arrayToRecord(attributesArray),
    resources: arrayToRecord(resourcesArray),
    characterCreation: characterCreation ?? undefined,
    items: itemsArray ? arrayToRecord(itemsArray) : undefined,
    abilities: abilitiesArray ? arrayToRecord(abilitiesArray) : undefined,
    traits: traitsArray ? arrayToRecord(traitsArray) : undefined,
    companions: companionsArray ? arrayToRecord(companionsArray) : undefined,
    regionComments: regionComments ?? undefined,
  };
}
