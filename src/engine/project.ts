/**
 * Project Management Module
 *
 * Utilities for creating, loading, and saving game projects.
 * Handles the file system operations for the editor.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  Story,
  StoryNode,
  GameManifest,
  Item,
  Ability,
  Trait,
  CompanionDefinition,
  ProjectStatus,
  AttributeDefinition,
  ResourceDefinition,
  CharacterCreationSchema,
  RegionComment,
} from '../types/index.js';
import { generatePrefixedId } from './validation.js';

// =============================================================================
// PROJECT CREATION
// =============================================================================

export interface CreateProjectOptions {
  /** Project title */
  title: string;

  /** Optional author name */
  author?: string;

  /** Optional description */
  description?: string;

  /** Whether to include a character creation node (default: true) */
  includeCharacterCreation?: boolean;
}

export interface CreateProjectResult {
  /** Absolute path to the created project folder */
  path: string;

  /** The generated project ID */
  id: string;

  /** The complete Story object */
  story: Story;
}

/**
 * Creates a new game project with minimal scaffolding.
 *
 * @param gamesDir - The parent directory where games are stored
 * @param options - Project configuration options
 * @returns The created project info
 */
export async function createProject(
  gamesDir: string,
  options: CreateProjectOptions
): Promise<CreateProjectResult> {
  // Generate a unique folder name from the title
  const existingFolders = await getExistingFolderNames(gamesDir);
  const folderName = generatePrefixedId(options.title, existingFolders);
  const projectPath = path.join(gamesDir, folderName);

  // Generate project ID (same as folder name for simplicity)
  const projectId = folderName;

  // Create scaffold nodes
  const includeCharCreation = options.includeCharacterCreation ?? true;

  const charCreationNodeId = 'char-creation';
  const startNodeId = 'start';
  const secondNodeId = 'second';

  const nodes: Record<string, StoryNode> = {};

  if (includeCharCreation) {
    // Character creation node → first dialogue node → second dialogue node
    nodes[charCreationNodeId] = {
      id: charCreationNodeId,
      type: 'characterCreation',
      name: 'Character Creation',
      next: startNodeId,
      editorPosition: { x: -250, y: 100 },
    };
  }

  nodes[startNodeId] = {
    id: startNodeId,
    type: 'dialogue',
    name: 'Start',
    text: 'Your story begins here...',
    choices: [{ text: 'Continue...', next: secondNodeId }],
    editorPosition: { x: 100, y: 100 },
  };

  nodes[secondNodeId] = {
    id: secondNodeId,
    type: 'dialogue',
    name: 'The Next Step',
    text: 'You continue your journey...',
    choices: [],
    editorPosition: { x: 400, y: 100 },
  };

  // The start node is the char creation node if present, otherwise the first dialogue node
  const effectiveStartNode = includeCharCreation ? charCreationNodeId : startNodeId;

  // Default attribute and resource
  const attributes: Record<string, AttributeDefinition> = {
    strength: { id: 'strength', name: 'Strength', description: 'Physical power', base: 8, min: 3, max: 18 },
  };
  const resources: Record<string, ResourceDefinition> = {
    health: { id: 'health', name: 'Health', description: 'Physical well-being', default: 100, min: 0, max: 100 },
  };

  // Sample entities to demonstrate patterns
  const items: Record<string, Item> = {
    journal: { id: 'journal', name: 'Journal', description: 'A worn leather journal', category: 'misc', stackable: false },
  };
  const traits: Record<string, Trait> = {
    curious: { id: 'curious', name: 'Curious', description: 'An inquisitive nature', category: 'background' },
  };

  // Character creation config
  const characterCreation: CharacterCreationSchema = {
    method: 'point-buy',
    pointBudget: 27,
  };

  // Create the manifest with starting items/traits
  const manifest: GameManifest = {
    id: projectId,
    title: options.title,
    status: 'draft',
    author: options.author,
    description: options.description,
    version: '0.1.0',
    startNode: effectiveStartNode,
    startingItems: [{ itemId: 'journal', quantity: 1 }],
    startingTraits: ['curious'],
  };

  // Create the story object
  const story: Story = {
    manifest,
    nodes,
    attributes,
    resources,
    items,
    traits,
    characterCreation,
  };

  // Create the folder structure
  await fs.mkdir(projectPath, { recursive: true });
  await fs.mkdir(path.join(projectPath, 'images'), { recursive: true });
  await fs.mkdir(path.join(projectPath, 'saves'), { recursive: true });

  // Write all initial files
  await writeManifest(projectPath, manifest);
  await writeStoryNodes(projectPath, story.nodes);
  await writeAttributes(projectPath, attributes);
  await writeResources(projectPath, resources);
  await writeItems(projectPath, items);
  await writeTraits(projectPath, traits);
  await writeCharacterCreation(projectPath, characterCreation);

  return {
    path: projectPath,
    id: projectId,
    story,
  };
}

async function getExistingFolderNames(gamesDir: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const entries = await fs.readdir(gamesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        names.add(entry.name);
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  return names;
}

// =============================================================================
// PROJECT SAVING
// =============================================================================

/**
 * Writes the game manifest to disk.
 */
export async function writeManifest(projectPath: string, manifest: GameManifest): Promise<void> {
  const manifestPath = path.join(projectPath, 'game.json');
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Writes story nodes to disk.
 * Converts the Record to an array for cleaner JSON.
 */
export async function writeStoryNodes(
  projectPath: string,
  nodes: Record<string, StoryNode>
): Promise<void> {
  const storyPath = path.join(projectPath, 'story.json');
  const nodesArray = Object.values(nodes);
  await fs.writeFile(storyPath, JSON.stringify(nodesArray, null, 2));
}

/**
 * Writes attribute definitions to disk.
 */
export async function writeAttributes(
  projectPath: string,
  attributes: Record<string, AttributeDefinition>
): Promise<void> {
  const filePath = path.join(projectPath, 'attributes.json');
  const arr = Object.values(attributes);
  await fs.writeFile(filePath, JSON.stringify(arr, null, 2));
}

/**
 * Writes resource definitions to disk.
 */
export async function writeResources(
  projectPath: string,
  resources: Record<string, ResourceDefinition>
): Promise<void> {
  const filePath = path.join(projectPath, 'resources.json');
  const arr = Object.values(resources);
  await fs.writeFile(filePath, JSON.stringify(arr, null, 2));
}

/**
 * Writes character creation schema to disk.
 */
export async function writeCharacterCreation(
  projectPath: string,
  schema: CharacterCreationSchema
): Promise<void> {
  const filePath = path.join(projectPath, 'character-creation.json');
  await fs.writeFile(filePath, JSON.stringify(schema, null, 2));
}

/**
 * Writes items to disk.
 */
export async function writeItems(projectPath: string, items: Record<string, Item>): Promise<void> {
  const itemsPath = path.join(projectPath, 'items.json');
  const itemsArray = Object.values(items);
  if (itemsArray.length === 0) {
    try {
      await fs.unlink(itemsPath);
    } catch {
      // File doesn't exist, that's fine
    }
  } else {
    await fs.writeFile(itemsPath, JSON.stringify(itemsArray, null, 2));
  }
}

/**
 * Writes abilities to disk.
 */
export async function writeAbilities(
  projectPath: string,
  abilities: Record<string, Ability>
): Promise<void> {
  const abilitiesPath = path.join(projectPath, 'abilities.json');
  const abilitiesArray = Object.values(abilities);
  if (abilitiesArray.length === 0) {
    try {
      await fs.unlink(abilitiesPath);
    } catch {
      // File doesn't exist
    }
  } else {
    await fs.writeFile(abilitiesPath, JSON.stringify(abilitiesArray, null, 2));
  }
}

/**
 * Writes traits to disk.
 */
export async function writeTraits(
  projectPath: string,
  traits: Record<string, Trait>
): Promise<void> {
  const traitsPath = path.join(projectPath, 'traits.json');
  const traitsArray = Object.values(traits);
  if (traitsArray.length === 0) {
    try {
      await fs.unlink(traitsPath);
    } catch {
      // File doesn't exist
    }
  } else {
    await fs.writeFile(traitsPath, JSON.stringify(traitsArray, null, 2));
  }
}

/**
 * Writes companions to disk.
 */
export async function writeCompanions(
  projectPath: string,
  companions: Record<string, CompanionDefinition>
): Promise<void> {
  const companionsPath = path.join(projectPath, 'companions.json');
  const companionsArray = Object.values(companions);
  if (companionsArray.length === 0) {
    try {
      await fs.unlink(companionsPath);
    } catch {
      // File doesn't exist
    }
  } else {
    await fs.writeFile(companionsPath, JSON.stringify(companionsArray, null, 2));
  }
}

/**
 * Writes region comments to disk.
 */
export async function writeRegionComments(
  projectPath: string,
  comments: RegionComment[]
): Promise<void> {
  const filePath = path.join(projectPath, 'region-comments.json');
  if (comments.length === 0) {
    try {
      await fs.unlink(filePath);
    } catch {
      // File doesn't exist
    }
  } else {
    await fs.writeFile(filePath, JSON.stringify(comments, null, 2));
  }
}

/**
 * Saves an entire story to disk.
 * Writes all components that exist in the story object.
 */
export async function saveStory(projectPath: string, story: Story): Promise<void> {
  await writeManifest(projectPath, story.manifest);
  await writeStoryNodes(projectPath, story.nodes);
  await writeAttributes(projectPath, story.attributes);
  await writeResources(projectPath, story.resources);

  if (story.characterCreation) {
    await writeCharacterCreation(projectPath, story.characterCreation);
  }
  if (story.items) {
    await writeItems(projectPath, story.items);
  }
  if (story.abilities) {
    await writeAbilities(projectPath, story.abilities);
  }
  if (story.traits) {
    await writeTraits(projectPath, story.traits);
  }
  if (story.companions) {
    await writeCompanions(projectPath, story.companions);
  }
  await writeRegionComments(projectPath, story.regionComments ?? []);
}

// =============================================================================
// PROJECT STATUS
// =============================================================================

/**
 * Updates the project status (draft/published).
 */
export async function setProjectStatus(
  projectPath: string,
  status: ProjectStatus
): Promise<void> {
  const manifestPath = path.join(projectPath, 'game.json');
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const manifest = JSON.parse(manifestRaw) as GameManifest;
  manifest.status = status;
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Checks if a project is published (playable) or still a draft.
 */
export function isPublished(manifest: GameManifest): boolean {
  return manifest.status === 'published';
}

/**
 * Checks if a project is a draft (work in progress).
 */
export function isDraft(manifest: GameManifest): boolean {
  return manifest.status !== 'published'; // Default to draft if not specified
}

// =============================================================================
// PROJECT DELETION
// =============================================================================

/**
 * Deletes a project folder and all its contents.
 * Use with caution!
 */
export async function deleteProject(projectPath: string): Promise<boolean> {
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// PROJECT DUPLICATION
// =============================================================================

/**
 * Duplicates an existing project with a new name.
 */
export async function duplicateProject(
  sourcePath: string,
  gamesDir: string,
  newTitle: string
): Promise<CreateProjectResult> {
  // Load the source project
  const manifestPath = path.join(sourcePath, 'game.json');
  const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
  const sourceManifest = JSON.parse(manifestRaw) as GameManifest;

  // Create a new project with the source as a base
  const result = await createProject(gamesDir, {
    title: newTitle,
    author: sourceManifest.author,
    description: sourceManifest.description,
  });

  // Copy all data files from source (overwriting the minimal scaffolding)
  const filesToCopy = [
    'story.json',
    'attributes.json',
    'resources.json',
    'character-creation.json',
    'items.json',
    'abilities.json',
    'traits.json',
    'companions.json',
    'region-comments.json',
  ];

  for (const file of filesToCopy) {
    const srcFile = path.join(sourcePath, file);
    const destFile = path.join(result.path, file);
    try {
      await fs.copyFile(srcFile, destFile);
    } catch {
      // File doesn't exist in source, skip
    }
  }

  // Copy images folder
  const srcImages = path.join(sourcePath, 'images');
  const destImages = path.join(result.path, 'images');
  try {
    await copyDirectory(srcImages, destImages);
  } catch {
    // No images to copy
  }

  // Reload and return the complete story
  const { loadGame } = await import('./loader.js');
  const story = await loadGame(result.path);

  return {
    ...result,
    story,
  };
}

async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}
