/**
 * Game Loader
 *
 * Loads game data from the standardized folder structure.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  Story,
  GameManifest,
  StoryNode,
  CompanionDefinition,
  Trait,
  Item,
  Ability,
  AttributeDefinition,
  ResourceDefinition,
  CharacterCreationSchema,
  RegionComment,
  SaveData,
} from '../types/index.js';

export interface GameFolder {
  /** Absolute path to the game folder */
  path: string;
  /** Game manifest data */
  manifest: GameManifest;
}

/**
 * Helper to load and parse a JSON file, returning undefined if it doesn't exist.
 */
async function loadOptionalJson<T>(filePath: string): Promise<T | undefined> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/**
 * Helper to convert an array of objects with 'id' to a record keyed by ID.
 */
function arrayToRecord<T extends { id: string }>(arr: T[]): Record<string, T> {
  const record: Record<string, T> = {};
  for (const item of arr) {
    record[item.id] = item;
  }
  return record;
}

/**
 * Discovers all games in a directory.
 * Each subfolder with a game.json is considered a game.
 */
export async function discoverGames(gamesDir: string): Promise<GameFolder[]> {
  const games: GameFolder[] = [];

  try {
    const entries = await fs.readdir(gamesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const gameDir = path.join(gamesDir, entry.name);
      const manifestPath = path.join(gameDir, 'game.json');

      try {
        const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestRaw) as GameManifest;
        games.push({ path: gameDir, manifest });
      } catch {
        // Not a valid game folder, skip
      }
    }
  } catch {
    // Games directory doesn't exist
  }

  return games;
}

/**
 * Loads a complete game from a folder.
 */
export async function loadGame(gameDir: string): Promise<Story> {
  // Load manifest (required)
  const manifestPath = path.join(gameDir, 'game.json');
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw) as GameManifest;

  // Load story nodes (required)
  const storyPath = path.join(gameDir, 'story.json');
  const storyRaw = await fs.readFile(storyPath, 'utf-8');
  const rawNodes = JSON.parse(storyRaw) as any[];
  // Migrate: nodes without a 'type' field default to 'dialogue'
  const nodesArray = rawNodes.map((n) => {
    if (!n.type) {
      return { ...n, type: 'dialogue', choices: n.choices ?? [] };
    }
    return n;
  }) as StoryNode[];
  const nodes = arrayToRecord(nodesArray);

  // Load game-defined schema (required)
  const attributesArray = await loadOptionalJson<AttributeDefinition[]>(
    path.join(gameDir, 'attributes.json')
  );
  const resourcesArray = await loadOptionalJson<ResourceDefinition[]>(
    path.join(gameDir, 'resources.json')
  );

  if (!attributesArray) {
    throw new Error(`Game "${manifest.title}" is missing attributes.json`);
  }
  if (!resourcesArray) {
    throw new Error(`Game "${manifest.title}" is missing resources.json`);
  }

  // Load optional schema files
  const characterCreation = await loadOptionalJson<CharacterCreationSchema>(
    path.join(gameDir, 'character-creation.json')
  );

  // Load optional entity data files
  const [itemsArray, abilitiesArray, traitsArray, companionsArray, regionComments] = await Promise.all([
    loadOptionalJson<Item[]>(path.join(gameDir, 'items.json')),
    loadOptionalJson<Ability[]>(path.join(gameDir, 'abilities.json')),
    loadOptionalJson<Trait[]>(path.join(gameDir, 'traits.json')),
    loadOptionalJson<CompanionDefinition[]>(path.join(gameDir, 'companions.json')),
    loadOptionalJson<RegionComment[]>(path.join(gameDir, 'region-comments.json')),
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

/**
 * Gets the images directory for a game.
 */
export function getImagesDir(gameDir: string): string {
  return path.join(gameDir, 'images');
}

/**
 * Gets the saves directory for a game.
 */
export function getSavesDir(gameDir: string): string {
  return path.join(gameDir, 'saves');
}

/**
 * Resolves an image path relative to the game folder.
 */
export function resolveImagePath(gameDir: string, imagePath: string): string {
  return path.join(gameDir, 'images', imagePath);
}

/**
 * Lists all save files for a game.
 */
export async function listSaves(gameDir: string): Promise<SaveData[]> {
  const savesDir = getSavesDir(gameDir);
  const saves: SaveData[] = [];

  try {
    const entries = await fs.readdir(savesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;

      try {
        const savePath = path.join(savesDir, entry.name);
        const saveRaw = await fs.readFile(savePath, 'utf-8');
        const save = JSON.parse(saveRaw) as SaveData;
        saves.push(save);
      } catch {
        // Invalid save file, skip
      }
    }
  } catch {
    // Saves directory doesn't exist
  }

  // Sort by date, newest first
  saves.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

  return saves;
}

/**
 * Saves game state to a file.
 */
export async function writeSave(gameDir: string, save: SaveData): Promise<void> {
  const savesDir = getSavesDir(gameDir);
  await fs.mkdir(savesDir, { recursive: true });

  const filename = `${save.slotName}.json`;
  const savePath = path.join(savesDir, filename);
  await fs.writeFile(savePath, JSON.stringify(save, null, 2));
}

/**
 * Loads a specific save file.
 */
export async function loadSave(gameDir: string, slotName: string): Promise<SaveData | undefined> {
  const savePath = path.join(getSavesDir(gameDir), `${slotName}.json`);
  return loadOptionalJson<SaveData>(savePath);
}

/**
 * Deletes a save file.
 */
export async function deleteSave(gameDir: string, slotName: string): Promise<boolean> {
  try {
    const savePath = path.join(getSavesDir(gameDir), `${slotName}.json`);
    await fs.unlink(savePath);
    return true;
  } catch {
    return false;
  }
}
