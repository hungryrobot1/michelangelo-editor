/**
 * Michelangelo Game Engine
 *
 * The core state machine that runs interactive fiction games.
 * Platform-agnostic - can be used with any UI renderer.
 */

import type {
  Story,
  StoryNode,
  GameState,
  PlayerCharacter,
  Choice,
  SaveData,
  ItemStack,
} from '../types/index.js';
import { isDialogueNode } from '../types/index.js';
import { evaluateCondition, getAvailableChoices } from './conditions.js';
import { applyEffects } from './effects.js';

const SAVE_VERSION = 3;

export interface EngineConfig {
  /** Called when entering a new node */
  onNodeEnter?: (node: StoryNode, state: GameState) => void;
  /** Called when the game reaches a dead end (no choices) */
  onGameEnd?: (state: GameState) => void;
}

export class GameEngine {
  private story: Story;
  private state: GameState;
  private config: EngineConfig;

  constructor(story: Story, config: EngineConfig = {}) {
    this.story = story;
    this.config = config;
    this.state = this.createInitialState(this.createDefaultPlayer());
  }

  /**
   * Creates a default player character using game-defined schema.
   */
  private createDefaultPlayer(): PlayerCharacter {
    const attributes: Record<string, number> = {};
    for (const attrDef of Object.values(this.story.attributes)) {
      attributes[attrDef.id] = attrDef.base;
    }

    const resources: Record<string, number> = {};
    for (const resDef of Object.values(this.story.resources)) {
      resources[resDef.id] = resDef.default;
    }

    return {
      id: 'player',
      name: 'Adventurer',
      attributes,
      resources,
      items: [],
      abilities: [],
      traits: [],
    };
  }

  /**
   * Creates the initial game state from a player character.
   */
  private createInitialState(player: PlayerCharacter): GameState {
    const manifest = this.story.manifest;

    // Apply starting items from manifest
    const items: ItemStack[] = [
      ...player.items,
      ...(manifest.startingItems ?? []),
    ];

    // Apply starting abilities and traits from manifest
    const abilities = [
      ...player.abilities,
      ...(manifest.startingAbilities ?? []),
    ];

    const traits = [
      ...player.traits,
      ...(manifest.startingTraits ?? []),
    ];

    return {
      player: {
        ...player,
        items,
        abilities,
        traits,
      },
      companions: [],
      currentNode: manifest.startNode,
      visitedNodes: [],
    };
  }

  /**
   * Initialize the game with a custom player character.
   */
  initializeWithCharacter(player: PlayerCharacter): void {
    this.state = this.createInitialState(player);
  }

  /**
   * Get the current game state.
   */
  getState(): Readonly<GameState> {
    return this.state;
  }

  /**
   * Get the story data.
   */
  getStory(): Readonly<Story> {
    return this.story;
  }

  /**
   * Get the current story node.
   */
  getCurrentNode(): StoryNode | undefined {
    return this.story.nodes[this.state.currentNode];
  }

  /**
   * Get available choices for the current node (filtered by conditions).
   * Returns empty for non-dialogue nodes.
   */
  getAvailableChoices(): Choice[] {
    const node = this.getCurrentNode();
    if (!node || !isDialogueNode(node)) return [];
    return getAvailableChoices(node.choices, this.state);
  }

  /**
   * Get all choices for the current node (including unavailable ones).
   * Useful for editors or debugging.
   */
  getAllChoices(): Array<Choice & { available: boolean }> {
    const node = this.getCurrentNode();
    if (!node || !isDialogueNode(node)) return [];
    return node.choices.map((choice) => ({
      ...choice,
      available: !choice.condition || evaluateCondition(choice.condition, this.state),
    }));
  }

  /**
   * Start or restart the game from the beginning.
   */
  start(): StoryNode | undefined {
    this.state = this.createInitialState(this.state.player);
    return this.enterNode(this.story.manifest.startNode);
  }

  /**
   * Start the game with a specific character.
   */
  startWithCharacter(player: PlayerCharacter): StoryNode | undefined {
    this.state = this.createInitialState(player);
    return this.enterNode(this.story.manifest.startNode);
  }

  /**
   * Start from a specific node with default state.
   * Useful for playtesting from a specific point in the story.
   * Skips character creation and begins with a default player.
   */
  startFromNode(nodeId: string): StoryNode | undefined {
    if (!this.story.nodes[nodeId]) {
      console.error(`Cannot start from node: "${nodeId}" not found`);
      return undefined;
    }
    this.state = this.createInitialState(this.createDefaultPlayer());
    return this.enterNode(nodeId);
  }

  /**
   * Make a choice by index (from available choices).
   * Returns the new node, or undefined if invalid.
   */
  makeChoice(choiceIndex: number): StoryNode | undefined {
    const availableChoices = this.getAvailableChoices();
    const choice = availableChoices[choiceIndex];

    if (!choice) {
      return undefined;
    }

    // Apply choice effects
    if (choice.effects) {
      this.state = applyEffects(choice.effects, this.state, this.story);
    }

    // Navigate to next node
    return this.enterNode(choice.next);
  }

  /**
   * Enter a specific node by ID.
   */
  private enterNode(nodeId: string): StoryNode | undefined {
    const node = this.story.nodes[nodeId];
    if (!node) {
      console.error(`Node not found: ${nodeId}`);
      return undefined;
    }

    // Update state
    this.state = {
      ...this.state,
      currentNode: nodeId,
      visitedNodes: this.state.visitedNodes.includes(nodeId)
        ? this.state.visitedNodes
        : [...this.state.visitedNodes, nodeId],
    };

    // Apply onEnter effects
    if (node.onEnter) {
      this.state = applyEffects(node.onEnter, this.state, this.story);
    }

    // Notify listeners
    this.config.onNodeEnter?.(node, this.state);

    // Check for game end — only dialogue nodes can be terminal
    // Character creation nodes wait for player input, so they're not game-over
    if (isDialogueNode(node) && this.getAvailableChoices().length === 0) {
      this.config.onGameEnd?.(this.state);
    }

    return node;
  }

  /**
   * Advance past a character creation node after the player finalizes their character.
   * Applies the finalized character to state and enters the next node.
   */
  completeCharacterCreation(player: PlayerCharacter): StoryNode | undefined {
    const node = this.getCurrentNode();
    if (!node || node.type !== 'characterCreation') {
      console.error('completeCharacterCreation called but current node is not a character creation node');
      return undefined;
    }
    this.state = this.createInitialState(player);
    // Preserve the visited nodes from before character creation
    this.state = {
      ...this.state,
      currentNode: node.next,
    };
    return this.enterNode(node.next);
  }

  /**
   * Check if the game has ended (dialogue node with no available choices).
   */
  isGameOver(): boolean {
    const node = this.getCurrentNode();
    if (!node || !isDialogueNode(node)) return false;
    return this.getAvailableChoices().length === 0;
  }

  /**
   * Create a save data object from current state.
   */
  createSaveData(slotName: string = 'quicksave'): SaveData {
    return {
      saveVersion: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      gameId: this.story.manifest.id,
      slotName,
      state: structuredClone(this.state),
    };
  }

  /**
   * Load state from save data.
   */
  loadSaveData(save: SaveData): boolean {
    if (save.saveVersion !== SAVE_VERSION) {
      console.warn(`Save version mismatch: expected ${SAVE_VERSION}, got ${save.saveVersion}`);
    }

    if (save.gameId !== this.story.manifest.id) {
      console.error(`Save is for a different game: ${save.gameId}`);
      return false;
    }

    // Validate that the current node exists
    if (!this.story.nodes[save.state.currentNode]) {
      console.error(`Invalid save: node ${save.state.currentNode} not found in story`);
      return false;
    }

    this.state = structuredClone(save.state);
    return true;
  }

  /**
   * Get the story metadata.
   */
  getManifest() {
    return this.story.manifest;
  }

  /**
   * Look up an item definition.
   */
  getItem(itemId: string) {
    return this.story.items?.[itemId];
  }

  /**
   * Look up an ability definition.
   */
  getAbility(abilityId: string) {
    return this.story.abilities?.[abilityId];
  }

  /**
   * Look up a trait definition.
   */
  getTrait(traitId: string) {
    return this.story.traits?.[traitId];
  }

  /**
   * Look up a companion definition.
   */
  getCompanionDefinition(companionId: string) {
    return this.story.companions?.[companionId];
  }

  /**
   * Get a companion's current state (if in party).
   */
  getCompanion(companionId: string) {
    return this.state.companions.find((c) => c.id === companionId);
  }

  /**
   * Get all companions currently in the party.
   */
  getPartyCompanions() {
    return this.state.companions.filter((c) => c.inParty);
  }
}
