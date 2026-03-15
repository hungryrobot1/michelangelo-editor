/**
 * Michelangelo Core Types
 *
 * These types define the structure of games, player state, and the
 * condition system that powers branching narratives.
 *
 * The engine provides structural contracts (grammar) while games
 * define their own vocabulary (attributes, resources).
 */

// =============================================================================
// GAME-DEFINED SCHEMA - Attributes, Resources
// =============================================================================

/** Definition for a game-defined attribute (e.g. strength, logic, social) */
export interface AttributeDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Starting/default value */
  base: number;

  /** Minimum allowed value (defaults to 0 if omitted) */
  min?: number;

  /** Maximum allowed value (no limit if omitted) */
  max?: number;
}

/** Definition for a game-defined resource pool (e.g. health, stress, reputation) */
export interface ResourceDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Starting/default value */
  default: number;

  /** Minimum allowed value (defaults to 0 if omitted) */
  min?: number;

  /** Maximum allowed value (no limit if omitted) */
  max?: number;
}

/** Configuration for character creation */
export interface CharacterCreationSchema {
  /** Creation method */
  method: 'point-buy' | 'freeform';

  /** Point budget for point-buy method */
  pointBudget?: number;

  /** Cost curve breakpoints: at or above threshold, each point costs this much */
  costCurve?: { threshold: number; cost: number }[];
}

/** Dynamic map of attribute/resource values keyed by ID */
export type AttributeMap = Record<string, number>;
export type ResourceMap = Record<string, number>;

// =============================================================================
// ITEMS - Countable, potentially consumable objects
// =============================================================================

export type ItemCategory = 'consumable' | 'equipment' | 'quest' | 'currency' | 'misc';

export interface Item {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Item category */
  category: ItemCategory;

  /** Whether multiple can stack in inventory */
  stackable: boolean;

  /** Maximum stack size (default: 99 for stackable, 1 for non-stackable) */
  maxStack?: number;

  /** Effects applied when item is used (for consumables) */
  onUse?: Effect[];

  /** Optional image */
  image?: string;

  /** Value in currency units (for trading) */
  value?: number;
}

/** An item in an inventory with quantity */
export interface ItemStack {
  itemId: string;
  quantity: number;
}

// =============================================================================
// ABILITIES - Actions that may consume resources
// =============================================================================

export interface AbilityCost {
  resource: string;
  amount: number;
}

export interface Ability {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Resource cost to use this ability */
  cost?: AbilityCost;

  /** Effects applied when ability is used */
  effects?: Effect[];

  /** Condition required to use this ability (beyond resource cost) */
  condition?: Condition;

  /** Optional icon/image */
  image?: string;
}

// =============================================================================
// TRAITS - Passive states, statuses, and backgrounds
// =============================================================================

export type TraitCategory = 'passive' | 'status' | 'background' | 'achievement';

export interface Trait {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description */
  description?: string;

  /** Category for organization */
  category?: TraitCategory;

  /** Optional icon/image */
  image?: string;
}

// =============================================================================
// CHARACTER - Base type for player and companions
// =============================================================================

export interface Character {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Optional description/bio */
  description?: string;

  /** Portrait image */
  image?: string;

  /** Attribute scores (keyed by game-defined attribute ID) */
  attributes: AttributeMap;

  /** Current resource levels (keyed by game-defined resource ID) */
  resources: ResourceMap;

  /** Inventory of items */
  items: ItemStack[];

  /** Known abilities */
  abilities: string[];

  /** Current traits */
  traits: string[];
}

/** The player character with additional meta info */
export interface PlayerCharacter extends Character {
  /** Player-chosen appearance description (for RP) */
  appearance?: string;
}

/** A companion with relationship tracking */
export interface CompanionCharacter extends Character {
  /** Relationship score with player (-100 to 100) */
  relationship: number;

  /** Whether this companion is currently in the party */
  inParty: boolean;
}

// =============================================================================
// COMPANION DEFINITION - Template for companions (in game data)
// =============================================================================

export interface CompanionDefinition {
  /** Unique identifier */
  id: string;

  /** Display name */
  name: string;

  /** Description */
  description?: string;

  /** Portrait image */
  image?: string;

  /** Starting attributes (attributeId → value, merged with game defaults) */
  baseAttributes?: Record<string, number>;

  /** Starting resources (resourceId → value, merged with game defaults) */
  baseResources?: Record<string, number>;

  /** Starting abilities */
  startingAbilities?: string[];

  /** Starting traits */
  startingTraits?: string[];

  /** Starting relationship score */
  startingRelationship?: number;
}

// =============================================================================
// CONDITIONS - Boolean expressions for gating choices
// =============================================================================

export type Condition =
  // Node/story conditions
  | { type: 'visited'; nodeId: string }
  | { type: 'notVisited'; nodeId: string }
  // Companion conditions
  | { type: 'hasCompanion'; companionId: string }
  | { type: 'notHasCompanion'; companionId: string }
  | { type: 'companionRelationship'; companionId: string; operator: '>=' | '>' | '=' | '<' | '<='; value: number }
  // Trait conditions
  | { type: 'hasTrait'; traitId: string }
  | { type: 'notHasTrait'; traitId: string }
  // Item conditions
  | { type: 'hasItem'; itemId: string; quantity?: number }
  | { type: 'notHasItem'; itemId: string }
  // Ability conditions
  | { type: 'hasAbility'; abilityId: string }
  | { type: 'notHasAbility'; abilityId: string }
  // Attribute/resource conditions (string IDs, validated against game schema)
  | { type: 'attribute'; attribute: string; operator: '>=' | '>' | '=' | '<' | '<='; value: number }
  | { type: 'resource'; resource: string; operator: '>=' | '>' | '=' | '<' | '<='; value: number }
  // Logical combinators
  | { type: 'and'; conditions: Condition[] }
  | { type: 'or'; conditions: Condition[] }
  | { type: 'not'; condition: Condition };

// =============================================================================
// EFFECTS - State changes that happen when entering a node or making a choice
// =============================================================================

export type Effect =
  // Trait effects
  | { type: 'addTrait'; traitId: string }
  | { type: 'removeTrait'; traitId: string }
  // Companion effects
  | { type: 'addCompanion'; companionId: string }
  | { type: 'removeCompanion'; companionId: string }
  | { type: 'modifyRelationship'; companionId: string; delta: number }
  // Attribute effects (string IDs, validated against game schema)
  | { type: 'modifyAttribute'; attribute: string; delta: number }
  | { type: 'setAttribute'; attribute: string; value: number }
  // Resource effects (string IDs, validated against game schema)
  | { type: 'modifyResource'; resource: string; delta: number }
  | { type: 'setResource'; resource: string; value: number }
  // Item effects
  | { type: 'addItem'; itemId: string; quantity?: number }
  | { type: 'removeItem'; itemId: string; quantity?: number }
  // Ability effects
  | { type: 'addAbility'; abilityId: string }
  | { type: 'removeAbility'; abilityId: string };

// =============================================================================
// CHOICES - Player options within a node
// =============================================================================

export interface Choice {
  /** Display text for the choice */
  text: string;

  /** ID of the node to navigate to */
  next: string;

  /** Optional condition that must be true for this choice to appear */
  condition?: Condition;

  /** Optional effects applied when this choice is selected */
  effects?: Effect[];

  /** Optional ability required (will check cost and condition) */
  requiresAbility?: string;
}

// =============================================================================
// NODES - The fundamental unit of story content
// =============================================================================

/** Common fields shared by all node types */
export interface BaseNode {
  /** Unique identifier for this node */
  id: string;

  /** Optional human-readable name (for editor organization) */
  name?: string;

  /** Effects applied when entering this node */
  onEnter?: Effect[];

  /** Position in editor grid (for visual editing) */
  editorPosition?: { x: number; y: number };
}

/** Dialogue node — the default narrative node with text and choices */
export interface DialogueNode extends BaseNode {
  type: 'dialogue';

  /** The narrative text displayed to the player */
  text: string;

  /** Optional image path (relative to game's images/ folder) */
  image?: string;

  /** Available choices from this node */
  choices: Choice[];
}

/** Character creation node — runs point-buy character creation */
export interface CharacterCreationNode extends BaseNode {
  type: 'characterCreation';

  /** ID of the node to advance to after creation completes */
  next: string;
}

/** Discriminated union of all node types */
export type StoryNode = DialogueNode | CharacterCreationNode;

/** Type guard helpers */
export function isDialogueNode(node: StoryNode): node is DialogueNode {
  return node.type === 'dialogue';
}

export function isCharacterCreationNode(node: StoryNode): node is CharacterCreationNode {
  return node.type === 'characterCreation';
}

/** All possible node type discriminators */
export type NodeType = StoryNode['type'];

// =============================================================================
// GAME MANIFEST - Metadata about a game
// =============================================================================

/** Project status for distinguishing work-in-progress from playable games */
export type ProjectStatus = 'draft' | 'published';

export interface GameManifest {
  /** Unique game identifier (for save file association) */
  id: string;

  /** Game title */
  title: string;

  /** Project status: 'draft' for WIP, 'published' for playable (default: 'draft') */
  status?: ProjectStatus;

  /** Author name(s) */
  author?: string;

  /** Game version */
  version?: string;

  /** Brief description */
  description?: string;

  /** ID of the starting node */
  startNode: string;

  /** Starting items given to all characters */
  startingItems?: ItemStack[];

  /** Starting abilities given to all characters */
  startingAbilities?: string[];

  /** Starting traits given to all characters */
  startingTraits?: string[];

  /** Companions available at game start */
  startingCompanions?: string[];
}

// =============================================================================
// STORY - The complete game data structure
// =============================================================================

export interface Story {
  /** Game metadata */
  manifest: GameManifest;

  /** All story nodes, keyed by ID */
  nodes: Record<string, StoryNode>;

  /** Game-defined attribute schema */
  attributes: Record<string, AttributeDefinition>;

  /** Game-defined resource schema */
  resources: Record<string, ResourceDefinition>;

  /** Character creation configuration (optional) */
  characterCreation?: CharacterCreationSchema;

  /** Item definitions */
  items?: Record<string, Item>;

  /** Ability definitions */
  abilities?: Record<string, Ability>;

  /** Trait definitions */
  traits?: Record<string, Trait>;

  /** Companion definitions */
  companions?: Record<string, CompanionDefinition>;

  /** Canvas region comments (editor-only, not used at runtime) */
  regionComments?: RegionComment[];
}

// =============================================================================
// REGION COMMENTS - Blueprint-style canvas annotations
// =============================================================================

/** A labeled rectangular region on the canvas for grouping/annotating nodes */
export interface RegionComment {
  /** Unique identifier */
  id: string;

  /** Display label shown in the header */
  label: string;

  /** Position on the canvas */
  position: { x: number; y: number };

  /** Size of the region box */
  size: { width: number; height: number };

  /** Optional color (CSS color string) */
  color?: string;

  /** Optional freeform notes/comment text */
  comment?: string;
}

// =============================================================================
// GAME STATE - Runtime state that persists across nodes
// =============================================================================

export interface GameState {
  /** The player character */
  player: PlayerCharacter;

  /** Current companions (full state, not just IDs) */
  companions: CompanionCharacter[];

  /** ID of the current node */
  currentNode: string;

  /** Set of visited node IDs */
  visitedNodes: string[];

  /** Flexible game-specific flags */
  flags?: Record<string, unknown>;
}

// =============================================================================
// SAVE DATA - What gets persisted to disk
// =============================================================================

export interface SaveData {
  /** Version of save format for migration */
  saveVersion: number;

  /** Timestamp of save */
  savedAt: string;

  /** Game ID this save belongs to */
  gameId: string;

  /** Save slot name */
  slotName: string;

  /** Full game state snapshot */
  state: GameState;
}

// =============================================================================
// ENGINE EVENTS - For UI integration
// =============================================================================

export interface EngineEvents {
  onNodeEnter: (node: StoryNode, state: GameState) => void;
  onEffectApplied: (effect: Effect, state: GameState) => void;
  onGameEnd: (state: GameState) => void;
}
