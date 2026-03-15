/**
 * Client-side Project Storage (IndexedDB)
 *
 * Provides the same project management interface as the server API
 * but stores everything locally in the browser using IndexedDB.
 * Used when the editor is deployed as a static site / PWA.
 */

import type {
  Story,
  StoryNode,
  GameManifest,
  AttributeDefinition,
  ResourceDefinition,
  Item,
  Trait,
  CharacterCreationSchema,
  RegionComment,
  Ability,
  CompanionDefinition,
} from '@engine/types/index.js';
import { generatePrefixedId } from '@engine/engine/validation.js';
import type { GameInfo, CreateProjectOptions, CreateProjectResult } from './engine';

// =============================================================================
// IndexedDB Setup
// =============================================================================

const DB_NAME = 'michelangelo-projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

interface StoredProject {
  id: string;
  story: Story;
  updatedAt: string;
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// =============================================================================
// Project CRUD — mirrors the server API
// =============================================================================

export async function listProjects(): Promise<GameInfo[]> {
  const db = await openDB();
  const all = await idbRequest<StoredProject[]>(txStore(db, 'readonly').getAll());
  db.close();
  return all.map((p) => ({
    id: p.id,
    path: `idb://${p.id}`,
    manifest: p.story.manifest,
  }));
}

export async function getProject(id: string): Promise<Story> {
  const db = await openDB();
  const record = await idbRequest<StoredProject | undefined>(txStore(db, 'readonly').get(id));
  db.close();
  if (!record) throw new Error(`Project not found: ${id}`);
  return record.story;
}

export async function saveProject(id: string, story: Story): Promise<void> {
  const db = await openDB();
  const record: StoredProject = { id, story, updatedAt: new Date().toISOString() };
  await idbRequest(txStore(db, 'readwrite').put(record));
  db.close();
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDB();
  await idbRequest(txStore(db, 'readwrite').delete(id));
  db.close();
}

export async function createProject(options: CreateProjectOptions): Promise<CreateProjectResult> {
  // Build the scaffold in memory (mirrors src/engine/project.ts)
  const db = await openDB();
  const allProjects = await idbRequest<StoredProject[]>(txStore(db, 'readonly').getAll());
  const existingIds = new Set(allProjects.map((p) => p.id));
  const projectId = generatePrefixedId(options.title, existingIds);

  const charCreationNodeId = 'char-creation';
  const startNodeId = 'start';
  const secondNodeId = 'second';

  const nodes: Record<string, StoryNode> = {
    [charCreationNodeId]: {
      id: charCreationNodeId,
      type: 'characterCreation',
      name: 'Character Creation',
      next: startNodeId,
      editorPosition: { x: -250, y: 100 },
    },
    [startNodeId]: {
      id: startNodeId,
      type: 'dialogue',
      name: 'Start',
      text: 'Your story begins here...',
      choices: [{ text: 'Continue...', next: secondNodeId }],
      editorPosition: { x: 100, y: 100 },
    },
    [secondNodeId]: {
      id: secondNodeId,
      type: 'dialogue',
      name: 'The Next Step',
      text: 'You continue your journey...',
      choices: [],
      editorPosition: { x: 400, y: 100 },
    },
  };

  const attributes: Record<string, AttributeDefinition> = {
    strength: { id: 'strength', name: 'Strength', description: 'Physical power', base: 8, min: 3, max: 18 },
  };
  const resources: Record<string, ResourceDefinition> = {
    health: { id: 'health', name: 'Health', description: 'Physical well-being', default: 100, min: 0, max: 100 },
  };
  const items: Record<string, Item> = {
    journal: { id: 'journal', name: 'Journal', description: 'A worn leather journal', category: 'misc', stackable: false },
  };
  const traits: Record<string, Trait> = {
    curious: { id: 'curious', name: 'Curious', description: 'An inquisitive nature', category: 'background' },
  };
  const characterCreation: CharacterCreationSchema = {
    method: 'point-buy',
    pointBudget: 27,
  };

  const manifest: GameManifest = {
    id: projectId,
    title: options.title,
    status: 'draft',
    author: options.author,
    description: options.description,
    version: '0.1.0',
    startNode: charCreationNodeId,
    startingItems: [{ itemId: 'journal', quantity: 1 }],
    startingTraits: ['curious'],
  };

  const story: Story = {
    manifest,
    nodes,
    attributes,
    resources,
    items,
    traits,
    characterCreation,
  };

  const record: StoredProject = { id: projectId, story, updatedAt: new Date().toISOString() };
  await idbRequest(txStore(db, 'readwrite').put(record));
  db.close();

  return { id: projectId, path: `idb://${projectId}`, story };
}

export async function duplicateProject(id: string, newTitle: string): Promise<CreateProjectResult> {
  const sourceStory = await getProject(id);

  const db = await openDB();
  const allProjects = await idbRequest<StoredProject[]>(txStore(db, 'readonly').getAll());
  const existingIds = new Set(allProjects.map((p) => p.id));
  const newId = generatePrefixedId(newTitle, existingIds);

  const story: Story = {
    ...sourceStory,
    manifest: { ...sourceStory.manifest, id: newId, title: newTitle },
  };

  const record: StoredProject = { id: newId, story, updatedAt: new Date().toISOString() };
  await idbRequest(txStore(db, 'readwrite').put(record));
  db.close();

  return { id: newId, path: `idb://${newId}`, story };
}

// =============================================================================
// Import / Export — File-based I/O
// =============================================================================

/**
 * Import a story from a single JSON file (complete Story object).
 */
export async function importFromJson(file: File): Promise<CreateProjectResult> {
  const text = await file.text();
  const story = JSON.parse(text) as Story;

  if (!story.manifest?.id || !story.manifest?.title || !story.nodes) {
    throw new Error('Invalid project file: missing manifest or nodes');
  }

  // Ensure unique ID
  const db = await openDB();
  const allProjects = await idbRequest<StoredProject[]>(txStore(db, 'readonly').getAll());
  const existingIds = new Set(allProjects.map((p) => p.id));
  let projectId = story.manifest.id;
  if (existingIds.has(projectId)) {
    projectId = generatePrefixedId(story.manifest.title, existingIds);
  }
  story.manifest.id = projectId;

  const record: StoredProject = { id: projectId, story, updatedAt: new Date().toISOString() };
  await idbRequest(txStore(db, 'readwrite').put(record));
  db.close();

  return { id: projectId, path: `idb://${projectId}`, story };
}

/**
 * Import a story from a folder of JSON files (the multi-file format).
 * Accepts a FileList from a directory input.
 */
export async function importFromFolder(files: FileList): Promise<CreateProjectResult> {
  const fileMap = new Map<string, File>();
  for (const file of files) {
    // file.webkitRelativePath is like "folder-name/game.json"
    const name = file.name.toLowerCase();
    fileMap.set(name, file);
  }

  async function readJson<T>(name: string): Promise<T | undefined> {
    const file = fileMap.get(name);
    if (!file) return undefined;
    return JSON.parse(await file.text()) as T;
  }

  function arrayToRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
    const record: Record<string, T> = {};
    for (const item of arr) record[item.id] = item;
    return record;
  }

  const manifest = await readJson<GameManifest>('game.json');
  if (!manifest) throw new Error('Folder is missing game.json');

  const rawNodes = await readJson<any[]>('story.json');
  if (!rawNodes) throw new Error('Folder is missing story.json');

  const nodesArray = rawNodes.map((n) => {
    if (!n.type) return { ...n, type: 'dialogue', choices: n.choices ?? [] };
    return n;
  }) as StoryNode[];

  const attributesArray = await readJson<AttributeDefinition[]>('attributes.json');
  const resourcesArray = await readJson<ResourceDefinition[]>('resources.json');
  if (!attributesArray) throw new Error('Folder is missing attributes.json');
  if (!resourcesArray) throw new Error('Folder is missing resources.json');

  const [characterCreation, itemsArray, abilitiesArray, traitsArray, companionsArray, regionComments] =
    await Promise.all([
      readJson<CharacterCreationSchema>('character-creation.json'),
      readJson<Item[]>('items.json'),
      readJson<Ability[]>('abilities.json'),
      readJson<Trait[]>('traits.json'),
      readJson<CompanionDefinition[]>('companions.json'),
      readJson<RegionComment[]>('region-comments.json'),
    ]);

  const story: Story = {
    manifest,
    nodes: arrayToRecord(nodesArray),
    attributes: arrayToRecord(attributesArray),
    resources: arrayToRecord(resourcesArray),
    characterCreation: characterCreation ?? undefined,
    items: itemsArray ? arrayToRecord(itemsArray) : undefined,
    abilities: abilitiesArray ? arrayToRecord(abilitiesArray) : undefined,
    traits: traitsArray ? arrayToRecord(traitsArray) : undefined,
    companions: companionsArray ? arrayToRecord(companionsArray) : undefined,
    regionComments: regionComments ?? undefined,
  };

  return importStoryToStorage(story);
}

/**
 * Save a Story into IndexedDB, deduplicating the ID if needed.
 */
async function importStoryToStorage(story: Story): Promise<CreateProjectResult> {
  const db = await openDB();
  const allProjects = await idbRequest<StoredProject[]>(txStore(db, 'readonly').getAll());
  const existingIds = new Set(allProjects.map((p) => p.id));
  let projectId = story.manifest.id;
  if (existingIds.has(projectId)) {
    projectId = generatePrefixedId(story.manifest.title, existingIds);
    story = { ...story, manifest: { ...story.manifest, id: projectId } };
  }

  const record: StoredProject = { id: projectId, story, updatedAt: new Date().toISOString() };
  await idbRequest(txStore(db, 'readwrite').put(record));
  db.close();

  return { id: projectId, path: `idb://${projectId}`, story };
}

/**
 * Download a story as a single JSON file.
 */
export function downloadStoryAsJson(story: Story): void {
  const json = JSON.stringify(story, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${story.manifest.id}.michelangelo.json`;
  a.click();
  URL.revokeObjectURL(url);
}
