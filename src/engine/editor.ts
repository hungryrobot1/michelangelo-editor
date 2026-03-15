/**
 * Editor Operations Module
 *
 * Pure-function CRUD operations for editing story data.
 * All functions take a Story and return a new Story (immutable).
 * No I/O, no side effects — this is the logic layer that
 * both the TUI and React GUI consume.
 */

import type {
  Story,
  StoryNode,
  DialogueNode,
  CharacterCreationNode,
  Choice,
  Condition,
  Effect,
  GameManifest,
  Item,
  Ability,
  Trait,
  CompanionDefinition,
  AttributeDefinition,
  ResourceDefinition,
  CharacterCreationSchema,
  RegionComment,
} from '../types/index.js';
import { isDialogueNode } from '../types/index.js';
import { generatePrefixedId } from './validation.js';
import {
  getConditionNodeRefs,
  getConditionItemRefs,
  getConditionAbilityRefs,
  getConditionTraitRefs,
  getConditionCompanionRefs,
  getConditionAttributeRefs,
  getConditionResourceRefs,
  getEffectItemRefs,
  getEffectAbilityRefs,
  getEffectTraitRefs,
  getEffectCompanionRefs,
  getEffectAttributeRefs,
  getEffectResourceRefs,
  findReachableNodes,
} from './validation.js';

// =============================================================================
// RESULT TYPES
// =============================================================================

export interface EditorResult {
  success: boolean;
  story: Story;
  warnings?: string[];
  error?: string;
}

export interface DuplicateNodeResult extends EditorResult {
  newNodeId?: string;
}

// =============================================================================
// ENTITY TYPE MAP
// =============================================================================

export interface EntityTypeMap {
  items: Item;
  abilities: Ability;
  traits: Trait;
  companions: CompanionDefinition;
  attributes: AttributeDefinition;
  resources: ResourceDefinition;
}

export type EntityType = keyof EntityTypeMap;

// =============================================================================
// REFERENCE TYPES
// =============================================================================

export interface NodeReference {
  nodeId: string;
  choiceIndex?: number;
  type: 'choice-next' | 'condition-visited' | 'condition-notVisited';
}

export interface EntityReference {
  nodeId: string;
  choiceIndex?: number;
  location: 'condition' | 'effect' | 'onEnter' | 'requiresAbility' | 'manifest';
  detail: string;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Gets an entity collection from a story, handling required vs optional collections.
 */
function getCollection<K extends EntityType>(
  story: Story,
  entityType: K
): Record<string, EntityTypeMap[K]> {
  switch (entityType) {
    case 'attributes':
      return story.attributes as Record<string, EntityTypeMap[K]>;
    case 'resources':
      return story.resources as Record<string, EntityTypeMap[K]>;
    case 'items':
      return (story.items ?? {}) as Record<string, EntityTypeMap[K]>;
    case 'abilities':
      return (story.abilities ?? {}) as Record<string, EntityTypeMap[K]>;
    case 'traits':
      return (story.traits ?? {}) as Record<string, EntityTypeMap[K]>;
    case 'companions':
      return (story.companions ?? {}) as Record<string, EntityTypeMap[K]>;
    default:
      return {} as Record<string, EntityTypeMap[K]>;
  }
}

/**
 * Returns a new story with the given collection replaced.
 */
function setCollection<K extends EntityType>(
  story: Story,
  entityType: K,
  collection: Record<string, EntityTypeMap[K]>
): Story {
  switch (entityType) {
    case 'attributes':
      return { ...story, attributes: collection as Record<string, AttributeDefinition> };
    case 'resources':
      return { ...story, resources: collection as Record<string, ResourceDefinition> };
    case 'items':
      return { ...story, items: collection as Record<string, Item> };
    case 'abilities':
      return { ...story, abilities: collection as Record<string, Ability> };
    case 'traits':
      return { ...story, traits: collection as Record<string, Trait> };
    case 'companions':
      return { ...story, companions: collection as Record<string, CompanionDefinition> };
    default:
      return story;
  }
}

/**
 * Rewrites entity references in a condition tree.
 */
function rewriteCondition(
  condition: Condition,
  entityType: EntityType,
  oldId: string,
  newId: string
): Condition {
  switch (condition.type) {
    case 'visited':
    case 'notVisited':
      if (entityType === 'items' || entityType === 'abilities' || entityType === 'traits' ||
          entityType === 'companions' || entityType === 'attributes' || entityType === 'resources') {
        return condition;
      }
      // nodeId rewriting handled in renameNodeId directly
      return condition;

    case 'hasItem':
    case 'notHasItem':
      if (entityType === 'items' && condition.itemId === oldId) {
        return { ...condition, itemId: newId };
      }
      return condition;

    case 'hasAbility':
    case 'notHasAbility':
      if (entityType === 'abilities' && condition.abilityId === oldId) {
        return { ...condition, abilityId: newId };
      }
      return condition;

    case 'hasTrait':
    case 'notHasTrait':
      if (entityType === 'traits' && condition.traitId === oldId) {
        return { ...condition, traitId: newId };
      }
      return condition;

    case 'hasCompanion':
    case 'notHasCompanion':
      if (entityType === 'companions' && condition.companionId === oldId) {
        return { ...condition, companionId: newId };
      }
      return condition;

    case 'companionRelationship':
      if (entityType === 'companions' && condition.companionId === oldId) {
        return { ...condition, companionId: newId };
      }
      return condition;

    case 'attribute':
      if (entityType === 'attributes' && condition.attribute === oldId) {
        return { ...condition, attribute: newId };
      }
      return condition;

    case 'resource':
      if (entityType === 'resources' && condition.resource === oldId) {
        return { ...condition, resource: newId };
      }
      return condition;

    case 'and':
      return {
        ...condition,
        conditions: condition.conditions.map((c) => rewriteCondition(c, entityType, oldId, newId)),
      };

    case 'or':
      return {
        ...condition,
        conditions: condition.conditions.map((c) => rewriteCondition(c, entityType, oldId, newId)),
      };

    case 'not':
      return {
        ...condition,
        condition: rewriteCondition(condition.condition, entityType, oldId, newId),
      };

    default:
      return condition;
  }
}

/**
 * Rewrites entity references in an effects array.
 */
function rewriteEffects(
  effects: Effect[],
  entityType: EntityType,
  oldId: string,
  newId: string
): Effect[] {
  return effects.map((effect) => {
    switch (effect.type) {
      case 'addItem':
      case 'removeItem':
        if (entityType === 'items' && effect.itemId === oldId) {
          return { ...effect, itemId: newId };
        }
        return effect;

      case 'addAbility':
      case 'removeAbility':
        if (entityType === 'abilities' && effect.abilityId === oldId) {
          return { ...effect, abilityId: newId };
        }
        return effect;

      case 'addTrait':
      case 'removeTrait':
        if (entityType === 'traits' && effect.traitId === oldId) {
          return { ...effect, traitId: newId };
        }
        return effect;

      case 'addCompanion':
      case 'removeCompanion':
        if (entityType === 'companions' && effect.companionId === oldId) {
          return { ...effect, companionId: newId };
        }
        return effect;

      case 'modifyRelationship':
        if (entityType === 'companions' && effect.companionId === oldId) {
          return { ...effect, companionId: newId };
        }
        return effect;

      case 'modifyAttribute':
      case 'setAttribute':
        if (entityType === 'attributes' && effect.attribute === oldId) {
          return { ...effect, attribute: newId };
        }
        return effect;

      case 'modifyResource':
      case 'setResource':
        if (entityType === 'resources' && effect.resource === oldId) {
          return { ...effect, resource: newId };
        }
        return effect;

      default:
        return effect;
    }
  });
}

/**
 * Removes conditions that reference a specific entity from a condition tree.
 * Returns null if the entire condition should be removed.
 */
function removeConditionRefs(
  condition: Condition,
  entityType: EntityType,
  entityId: string
): Condition | null {
  // Check if this condition directly references the entity
  const directRef = conditionReferencesEntity(condition, entityType, entityId);
  if (directRef) return null;

  switch (condition.type) {
    case 'and':
    case 'or': {
      const filtered = condition.conditions
        .map((c) => removeConditionRefs(c, entityType, entityId))
        .filter((c): c is Condition => c !== null);
      if (filtered.length === 0) return null;
      if (filtered.length === 1) return filtered[0]!;
      return { ...condition, conditions: filtered };
    }
    case 'not': {
      const inner = removeConditionRefs(condition.condition, entityType, entityId);
      if (!inner) return null;
      return { ...condition, condition: inner };
    }
    default:
      return condition;
  }
}

/**
 * Checks if a condition directly (not through combinators) references an entity.
 */
function conditionReferencesEntity(
  condition: Condition,
  entityType: EntityType,
  entityId: string
): boolean {
  switch (condition.type) {
    case 'hasItem':
    case 'notHasItem':
      return entityType === 'items' && condition.itemId === entityId;
    case 'hasAbility':
    case 'notHasAbility':
      return entityType === 'abilities' && condition.abilityId === entityId;
    case 'hasTrait':
    case 'notHasTrait':
      return entityType === 'traits' && condition.traitId === entityId;
    case 'hasCompanion':
    case 'notHasCompanion':
      return entityType === 'companions' && condition.companionId === entityId;
    case 'companionRelationship':
      return entityType === 'companions' && condition.companionId === entityId;
    case 'attribute':
      return entityType === 'attributes' && condition.attribute === entityId;
    case 'resource':
      return entityType === 'resources' && condition.resource === entityId;
    default:
      return false;
  }
}

/**
 * Removes effects that reference a specific entity.
 */
function removeEffectRefs(
  effects: Effect[],
  entityType: EntityType,
  entityId: string
): Effect[] {
  return effects.filter((effect) => {
    switch (effect.type) {
      case 'addItem':
      case 'removeItem':
        return !(entityType === 'items' && effect.itemId === entityId);
      case 'addAbility':
      case 'removeAbility':
        return !(entityType === 'abilities' && effect.abilityId === entityId);
      case 'addTrait':
      case 'removeTrait':
        return !(entityType === 'traits' && effect.traitId === entityId);
      case 'addCompanion':
      case 'removeCompanion':
      case 'modifyRelationship':
        return !(entityType === 'companions' && effect.companionId === entityId);
      case 'modifyAttribute':
      case 'setAttribute':
        return !(entityType === 'attributes' && effect.attribute === entityId);
      case 'modifyResource':
      case 'setResource':
        return !(entityType === 'resources' && effect.resource === entityId);
      default:
        return true;
    }
  });
}

/**
 * Gets the appropriate condition ref extractor for an entity type.
 */
function getConditionRefExtractor(entityType: EntityType): ((c: Condition) => string[]) | null {
  switch (entityType) {
    case 'items': return getConditionItemRefs;
    case 'abilities': return getConditionAbilityRefs;
    case 'traits': return getConditionTraitRefs;
    case 'companions': return getConditionCompanionRefs;
    case 'attributes': return getConditionAttributeRefs;
    case 'resources': return getConditionResourceRefs;
    default: return null;
  }
}

/**
 * Gets the appropriate effect ref extractor for an entity type.
 */
function getEffectRefExtractor(entityType: EntityType): ((e: Effect[]) => string[]) | null {
  switch (entityType) {
    case 'items': return getEffectItemRefs;
    case 'abilities': return getEffectAbilityRefs;
    case 'traits': return getEffectTraitRefs;
    case 'companions': return getEffectCompanionRefs;
    case 'attributes': return getEffectAttributeRefs;
    case 'resources': return getEffectResourceRefs;
    default: return null;
  }
}

/**
 * Rewrites all nodes in a story, applying a transform to each choice's condition and effects,
 * and each node's onEnter effects.
 */
function rewriteAllNodes(
  story: Story,
  entityType: EntityType,
  oldId: string,
  newId: string
): Record<string, StoryNode> {
  const newNodes: Record<string, StoryNode> = {};
  for (const [id, node] of Object.entries(story.nodes)) {
    const newOnEnter = node.onEnter
      ? rewriteEffects(node.onEnter, entityType, oldId, newId)
      : undefined;

    if (isDialogueNode(node)) {
      const newChoices = node.choices.map((choice) => {
        let updated = { ...choice };
        if (choice.condition) {
          updated.condition = rewriteCondition(choice.condition, entityType, oldId, newId);
        }
        if (choice.effects) {
          updated.effects = rewriteEffects(choice.effects, entityType, oldId, newId);
        }
        if (entityType === 'abilities' && choice.requiresAbility === oldId) {
          updated.requiresAbility = newId;
        }
        return updated;
      });
      newNodes[id] = { ...node, choices: newChoices, onEnter: newOnEnter };
    } else {
      newNodes[id] = { ...node, onEnter: newOnEnter };
    }
  }
  return newNodes;
}

// =============================================================================
// NODE CRUD
// =============================================================================

/** Input type for addNode — discriminated union with optional id */
export type AddNodeInput =
  | (Omit<DialogueNode, 'id'> & { id?: string })
  | (Omit<CharacterCreationNode, 'id'> & { id?: string });

/**
 * Adds a new node to the story.
 * Generates an ID if not provided.
 */
export function addNode(
  story: Story,
  node: AddNodeInput
): EditorResult {
  const existingIds = new Set(Object.keys(story.nodes));
  const nodeId = node.id && !existingIds.has(node.id)
    ? node.id
    : generatePrefixedId(node.name || 'node', existingIds);

  let newNode: StoryNode;
  if (node.type === 'characterCreation') {
    newNode = { ...node, id: nodeId };
  } else {
    newNode = { ...node, id: nodeId, choices: node.choices ?? [] };
  }

  return {
    success: true,
    story: {
      ...story,
      nodes: { ...story.nodes, [nodeId]: newNode },
    },
  };
}

/**
 * Updates an existing node with partial changes.
 * Accepts any partial node fields — the type discriminant is preserved from the original.
 */
export function updateNode(
  story: Story,
  nodeId: string,
  updates: Record<string, unknown>
): EditorResult {
  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }

  const updatedNode = { ...node, ...updates } as StoryNode;

  return {
    success: true,
    story: {
      ...story,
      nodes: {
        ...story.nodes,
        [nodeId]: updatedNode,
      },
    },
  };
}

/**
 * Deletes a node from the story.
 * Refuses to delete the start node.
 * Removes choices pointing to this node from other nodes.
 * Reports condition references as warnings (or removes them if cascade is true).
 */
export function deleteNode(
  story: Story,
  nodeId: string,
  options?: { cascade?: boolean }
): EditorResult {
  if (nodeId === story.manifest.startNode) {
    return { success: false, story, error: 'Cannot delete the start node. Change the start node first.' };
  }

  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }

  const warnings: string[] = [];
  const newNodes: Record<string, StoryNode> = {};

  for (const [id, n] of Object.entries(story.nodes)) {
    if (id === nodeId) continue; // Remove the deleted node

    if (n.type === 'characterCreation') {
      // Character creation node: warn if its 'next' points to deleted node
      if (n.next === nodeId) {
        warnings.push(`Character creation node "${id}" links to deleted node "${nodeId}"`);
      }
      newNodes[id] = n;
      continue;
    }

    // Dialogue node: remove choices pointing to deleted node
    const filteredChoices = n.choices.filter((choice) => {
      if (choice.next === nodeId) {
        warnings.push(`Removed choice "${choice.text}" from node "${id}" (linked to deleted node)`);
        return false;
      }
      return true;
    });

    // Handle condition references to the deleted node
    let processedChoices = filteredChoices;
    if (options?.cascade) {
      processedChoices = filteredChoices.map((choice) => {
        if (!choice.condition) return choice;
        const refs = getConditionNodeRefs(choice.condition);
        if (refs.includes(nodeId)) {
          warnings.push(`Removed condition referencing deleted node "${nodeId}" from choice in "${id}"`);
          return { ...choice, condition: undefined };
        }
        return choice;
      });
    } else {
      // Just warn about dangling condition refs
      for (const choice of filteredChoices) {
        if (choice.condition) {
          const refs = getConditionNodeRefs(choice.condition);
          if (refs.includes(nodeId)) {
            warnings.push(`Choice in node "${id}" has condition referencing deleted node "${nodeId}"`);
          }
        }
      }
    }

    newNodes[id] = { ...n, choices: processedChoices };
  }

  return {
    success: true,
    story: { ...story, nodes: newNodes },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Duplicates a node with a new ID.
 * Choices keep their original targets.
 */
export function duplicateNode(
  story: Story,
  nodeId: string,
  options?: { position?: { x: number; y: number } }
): DuplicateNodeResult {
  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }

  const existingIds = new Set(Object.keys(story.nodes));
  const newId = generatePrefixedId(node.name || 'node', existingIds);
  const cloned = structuredClone(node);

  // Update ID and position
  cloned.id = newId;
  if (options?.position) {
    cloned.editorPosition = options.position;
  } else if (cloned.editorPosition) {
    cloned.editorPosition = {
      x: cloned.editorPosition.x + 50,
      y: cloned.editorPosition.y + 50,
    };
  }

  return {
    success: true,
    story: {
      ...story,
      nodes: { ...story.nodes, [newId]: cloned },
    },
    newNodeId: newId,
  };
}

// =============================================================================
// CHOICE MANAGEMENT
// =============================================================================

/**
 * Adds a choice to a node.
 */
export function addChoice(
  story: Story,
  nodeId: string,
  choice: Choice
): EditorResult {
  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }
  if (!isDialogueNode(node)) {
    return { success: false, story, error: `Cannot add choices to a ${node.type} node` };
  }

  return {
    success: true,
    story: {
      ...story,
      nodes: {
        ...story.nodes,
        [nodeId]: {
          ...node,
          choices: [...node.choices, choice],
        },
      },
    },
  };
}

/**
 * Updates a specific choice in a node.
 */
export function updateChoice(
  story: Story,
  nodeId: string,
  choiceIndex: number,
  updates: Partial<Choice>
): EditorResult {
  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }
  if (!isDialogueNode(node)) {
    return { success: false, story, error: `Cannot update choices on a ${node.type} node` };
  }
  if (choiceIndex < 0 || choiceIndex >= node.choices.length) {
    return { success: false, story, error: `Choice index ${choiceIndex} out of range` };
  }

  const newChoices = [...node.choices];
  newChoices[choiceIndex] = { ...newChoices[choiceIndex]!, ...updates };

  return {
    success: true,
    story: {
      ...story,
      nodes: {
        ...story.nodes,
        [nodeId]: { ...node, choices: newChoices },
      },
    },
  };
}

/**
 * Removes a choice from a node by index.
 */
export function removeChoice(
  story: Story,
  nodeId: string,
  choiceIndex: number
): EditorResult {
  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }
  if (!isDialogueNode(node)) {
    return { success: false, story, error: `Cannot remove choices from a ${node.type} node` };
  }
  if (choiceIndex < 0 || choiceIndex >= node.choices.length) {
    return { success: false, story, error: `Choice index ${choiceIndex} out of range` };
  }

  const newChoices = node.choices.filter((_, i) => i !== choiceIndex);

  return {
    success: true,
    story: {
      ...story,
      nodes: {
        ...story.nodes,
        [nodeId]: { ...node, choices: newChoices },
      },
    },
  };
}

/**
 * Reorders choices in a node.
 * newOrder is an array of old indices in the desired new order.
 * e.g. [2, 0, 1] means old choice #2 becomes first.
 */
export function reorderChoices(
  story: Story,
  nodeId: string,
  newOrder: number[]
): EditorResult {
  const node = story.nodes[nodeId];
  if (!node) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }
  if (!isDialogueNode(node)) {
    return { success: false, story, error: `Cannot reorder choices on a ${node.type} node` };
  }

  // Validate newOrder is a valid permutation
  if (newOrder.length !== node.choices.length) {
    return { success: false, story, error: `newOrder length (${newOrder.length}) doesn't match choices count (${node.choices.length})` };
  }

  const sorted = [...newOrder].sort((a, b) => a - b);
  const expected = Array.from({ length: node.choices.length }, (_, i) => i);
  if (JSON.stringify(sorted) !== JSON.stringify(expected)) {
    return { success: false, story, error: 'newOrder must be a valid permutation of choice indices' };
  }

  const reordered = newOrder.map((oldIndex) => node.choices[oldIndex]!);

  return {
    success: true,
    story: {
      ...story,
      nodes: {
        ...story.nodes,
        [nodeId]: { ...node, choices: reordered },
      },
    },
  };
}

// =============================================================================
// ENTITY CRUD
// =============================================================================

/**
 * Adds an entity to a collection.
 * Generates an ID if not provided.
 */
export function addEntity<K extends EntityType>(
  story: Story,
  entityType: K,
  entity: Omit<EntityTypeMap[K], 'id'> & { id?: string }
): EditorResult {
  const collection = getCollection(story, entityType);
  const existingIds = new Set(Object.keys(collection));

  const entityId = entity.id && !existingIds.has(entity.id)
    ? entity.id
    : generatePrefixedId(
        (entity as { name?: string }).name || entityType.slice(0, -1),
        existingIds
      );

  const newEntity = { ...entity, id: entityId } as EntityTypeMap[K];
  const newCollection = { ...collection, [entityId]: newEntity };

  return {
    success: true,
    story: setCollection(story, entityType, newCollection),
  };
}

/**
 * Updates an existing entity with partial changes.
 */
export function updateEntity<K extends EntityType>(
  story: Story,
  entityType: K,
  entityId: string,
  updates: Partial<Omit<EntityTypeMap[K], 'id'>>
): EditorResult {
  const collection = getCollection(story, entityType);
  const existing = collection[entityId];
  if (!existing) {
    return { success: false, story, error: `${entityType} "${entityId}" not found` };
  }

  const newCollection = {
    ...collection,
    [entityId]: { ...existing, ...updates },
  };

  return {
    success: true,
    story: setCollection(story, entityType, newCollection),
  };
}

/**
 * Removes an entity from a collection.
 * Default: warns about dangling references.
 * cascade: true removes referencing conditions/effects.
 */
export function removeEntity<K extends EntityType>(
  story: Story,
  entityType: K,
  entityId: string,
  options?: { cascade?: boolean }
): EditorResult {
  const collection = getCollection(story, entityType);
  if (!collection[entityId]) {
    return { success: false, story, error: `${entityType} "${entityId}" not found` };
  }

  const warnings: string[] = [];

  // Remove from collection
  const newCollection = { ...collection };
  delete newCollection[entityId];
  let newStory = setCollection(story, entityType, newCollection);

  // Find and handle references in nodes
  const conditionExtractor = getConditionRefExtractor(entityType);
  const effectExtractor = getEffectRefExtractor(entityType);

  if (options?.cascade) {
    // Cascade: remove referencing conditions/effects
    const newNodes: Record<string, StoryNode> = {};
    for (const [id, node] of Object.entries(newStory.nodes)) {
      // Handle onEnter effects (common to all node types)
      let newOnEnter = node.onEnter;
      if (newOnEnter) {
        const cleaned = removeEffectRefs(newOnEnter, entityType, entityId);
        if (cleaned.length !== newOnEnter.length) {
          warnings.push(`Removed onEnter effect(s) referencing "${entityId}" from node "${id}"`);
        }
        newOnEnter = cleaned.length > 0 ? cleaned : undefined;
      }

      if (isDialogueNode(node)) {
        const newChoices = node.choices.map((choice) => {
          let updated = { ...choice };

          // Remove conditions referencing this entity
          if (updated.condition) {
            const cleaned = removeConditionRefs(updated.condition, entityType, entityId);
            if (cleaned === null) {
              warnings.push(`Removed condition from choice in node "${id}"`);
              updated = { ...updated, condition: undefined };
            } else if (cleaned !== updated.condition) {
              warnings.push(`Simplified condition in choice in node "${id}"`);
              updated = { ...updated, condition: cleaned };
            }
          }

          // Remove effects referencing this entity
          if (updated.effects) {
            const cleaned = removeEffectRefs(updated.effects, entityType, entityId);
            if (cleaned.length !== updated.effects.length) {
              warnings.push(`Removed effect(s) referencing "${entityId}" from choice in node "${id}"`);
            }
            updated = { ...updated, effects: cleaned.length > 0 ? cleaned : undefined };
          }

          // Remove requiresAbility reference
          if (entityType === 'abilities' && updated.requiresAbility === entityId) {
            warnings.push(`Removed requiresAbility "${entityId}" from choice in node "${id}"`);
            updated = { ...updated, requiresAbility: undefined };
          }

          return updated;
        });
        newNodes[id] = { ...node, choices: newChoices, onEnter: newOnEnter };
      } else {
        newNodes[id] = { ...node, onEnter: newOnEnter };
      }
    }
    newStory = { ...newStory, nodes: newNodes };
  } else {
    // Warn mode: just report dangling references
    for (const [id, node] of Object.entries(newStory.nodes)) {
      if (isDialogueNode(node)) {
        for (let ci = 0; ci < node.choices.length; ci++) {
          const choice = node.choices[ci]!;
          if (choice.condition && conditionExtractor) {
            const refs = conditionExtractor(choice.condition);
            if (refs.includes(entityId)) {
              warnings.push(`Choice ${ci} in node "${id}" has condition referencing deleted ${entityType} "${entityId}"`);
            }
          }
          if (choice.effects && effectExtractor) {
            const refs = effectExtractor(choice.effects);
            if (refs.includes(entityId)) {
              warnings.push(`Choice ${ci} in node "${id}" has effect referencing deleted ${entityType} "${entityId}"`);
            }
          }
          if (entityType === 'abilities' && choice.requiresAbility === entityId) {
            warnings.push(`Choice ${ci} in node "${id}" requires deleted ability "${entityId}"`);
          }
        }
      }
      if (node.onEnter && effectExtractor) {
        const refs = effectExtractor(node.onEnter);
        if (refs.includes(entityId)) {
          warnings.push(`Node "${id}" has onEnter effect referencing deleted ${entityType} "${entityId}"`);
        }
      }
    }
  }

  // Check manifest starting lists
  const manifestWarnings = checkManifestReferences(newStory, entityType, entityId);
  if (manifestWarnings.length > 0) {
    if (options?.cascade) {
      newStory = removeManifestReferences(newStory, entityType, entityId);
      warnings.push(...manifestWarnings.map((w) => `Removed: ${w}`));
    } else {
      warnings.push(...manifestWarnings);
    }
  }

  // Check companion/ability cross-references
  const crossRefWarnings = checkCrossReferences(newStory, entityType, entityId);
  warnings.push(...crossRefWarnings);

  return {
    success: true,
    story: newStory,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Checks manifest for references to a removed entity.
 */
function checkManifestReferences(story: Story, entityType: EntityType, entityId: string): string[] {
  const warnings: string[] = [];
  const m = story.manifest;

  if (entityType === 'items') {
    if (m.startingItems?.some((s) => s.itemId === entityId)) {
      warnings.push(`Manifest starting items references "${entityId}"`);
    }
  }
  if (entityType === 'abilities') {
    if (m.startingAbilities?.includes(entityId)) {
      warnings.push(`Manifest starting abilities references "${entityId}"`);
    }
  }
  if (entityType === 'traits') {
    if (m.startingTraits?.includes(entityId)) {
      warnings.push(`Manifest starting traits references "${entityId}"`);
    }
  }
  if (entityType === 'companions') {
    if (m.startingCompanions?.includes(entityId)) {
      warnings.push(`Manifest starting companions references "${entityId}"`);
    }
  }

  return warnings;
}

/**
 * Removes manifest references to a deleted entity.
 */
function removeManifestReferences(story: Story, entityType: EntityType, entityId: string): Story {
  const m = { ...story.manifest };

  if (entityType === 'items' && m.startingItems) {
    m.startingItems = m.startingItems.filter((s) => s.itemId !== entityId);
  }
  if (entityType === 'abilities' && m.startingAbilities) {
    m.startingAbilities = m.startingAbilities.filter((id) => id !== entityId);
  }
  if (entityType === 'traits' && m.startingTraits) {
    m.startingTraits = m.startingTraits.filter((id) => id !== entityId);
  }
  if (entityType === 'companions' && m.startingCompanions) {
    m.startingCompanions = m.startingCompanions.filter((id) => id !== entityId);
  }

  return { ...story, manifest: m };
}

/**
 * Checks cross-references between entity types (companions, abilities).
 */
function checkCrossReferences(story: Story, entityType: EntityType, entityId: string): string[] {
  const warnings: string[] = [];

  if (entityType === 'attributes') {
    // Check companion base attributes
    for (const comp of Object.values(story.companions ?? {})) {
      if (comp.baseAttributes && entityId in comp.baseAttributes) {
        warnings.push(`Companion "${comp.name}" has base value for deleted attribute "${entityId}"`);
      }
    }
  }

  if (entityType === 'resources') {
    // Check ability costs
    for (const ability of Object.values(story.abilities ?? {})) {
      if (ability.cost?.resource === entityId) {
        warnings.push(`Ability "${ability.name}" costs deleted resource "${entityId}"`);
      }
    }
    // Check companion base resources
    for (const comp of Object.values(story.companions ?? {})) {
      if (comp.baseResources && entityId in comp.baseResources) {
        warnings.push(`Companion "${comp.name}" has base value for deleted resource "${entityId}"`);
      }
    }
  }

  return warnings;
}

// =============================================================================
// REFERENCE QUERIES
// =============================================================================

/**
 * Finds all references to a node (choices pointing to it, conditions referencing it).
 */
export function findNodeReferences(story: Story, nodeId: string): NodeReference[] {
  const refs: NodeReference[] = [];

  for (const [id, node] of Object.entries(story.nodes)) {
    if (node.type === 'characterCreation' && node.next === nodeId) {
      refs.push({ nodeId: id, type: 'choice-next' });
    }

    if (!isDialogueNode(node)) continue;

    for (let ci = 0; ci < node.choices.length; ci++) {
      const choice = node.choices[ci]!;

      // Choice target
      if (choice.next === nodeId) {
        refs.push({ nodeId: id, choiceIndex: ci, type: 'choice-next' });
      }

      // Condition references
      if (choice.condition) {
        const condRefs = getConditionNodeRefs(choice.condition);
        for (const ref of condRefs) {
          if (ref === nodeId) {
            // Determine type
            const hasVisited = conditionContainsType(choice.condition, 'visited', nodeId);
            const hasNotVisited = conditionContainsType(choice.condition, 'notVisited', nodeId);
            if (hasVisited) {
              refs.push({ nodeId: id, choiceIndex: ci, type: 'condition-visited' });
            }
            if (hasNotVisited) {
              refs.push({ nodeId: id, choiceIndex: ci, type: 'condition-notVisited' });
            }
          }
        }
      }
    }
  }

  return refs;
}

/**
 * Checks if a condition tree contains a specific type referencing a specific nodeId.
 */
function conditionContainsType(condition: Condition, type: 'visited' | 'notVisited', targetNodeId: string): boolean {
  if (condition.type === type && 'nodeId' in condition && condition.nodeId === targetNodeId) {
    return true;
  }
  if (condition.type === 'and' || condition.type === 'or') {
    return condition.conditions.some((c) => conditionContainsType(c, type, targetNodeId));
  }
  if (condition.type === 'not') {
    return conditionContainsType(condition.condition, type, targetNodeId);
  }
  return false;
}

/**
 * Finds all references to an entity across the story.
 */
export function findEntityReferences(
  story: Story,
  entityType: EntityType,
  entityId: string
): EntityReference[] {
  const refs: EntityReference[] = [];
  const conditionExtractor = getConditionRefExtractor(entityType);
  const effectExtractor = getEffectRefExtractor(entityType);

  // Check manifest
  const m = story.manifest;
  if (entityType === 'items' && m.startingItems?.some((s) => s.itemId === entityId)) {
    refs.push({ nodeId: '', location: 'manifest', detail: 'Starting items' } as EntityReference);
  }
  if (entityType === 'abilities' && m.startingAbilities?.includes(entityId)) {
    refs.push({ nodeId: '', location: 'manifest', detail: 'Starting abilities' } as EntityReference);
  }
  if (entityType === 'traits' && m.startingTraits?.includes(entityId)) {
    refs.push({ nodeId: '', location: 'manifest', detail: 'Starting traits' } as EntityReference);
  }
  if (entityType === 'companions' && m.startingCompanions?.includes(entityId)) {
    refs.push({ nodeId: '', location: 'manifest', detail: 'Starting companions' } as EntityReference);
  }

  // Check all nodes
  for (const [id, node] of Object.entries(story.nodes)) {
    // Check choices (dialogue nodes only)
    if (isDialogueNode(node)) {
      for (let ci = 0; ci < node.choices.length; ci++) {
        const choice = node.choices[ci]!;

        if (choice.condition && conditionExtractor) {
          const condRefs = conditionExtractor(choice.condition);
          if (condRefs.includes(entityId)) {
            refs.push({ nodeId: id, choiceIndex: ci, location: 'condition', detail: `Condition in choice "${choice.text}"` });
          }
        }

        if (choice.effects && effectExtractor) {
          const effRefs = effectExtractor(choice.effects);
          if (effRefs.includes(entityId)) {
            refs.push({ nodeId: id, choiceIndex: ci, location: 'effect', detail: `Effect in choice "${choice.text}"` });
          }
        }

        if (entityType === 'abilities' && choice.requiresAbility === entityId) {
          refs.push({ nodeId: id, choiceIndex: ci, location: 'requiresAbility', detail: `Required by choice "${choice.text}"` });
        }
      }
    }

    // Check onEnter
    if (node.onEnter && effectExtractor) {
      const effRefs = effectExtractor(node.onEnter);
      if (effRefs.includes(entityId)) {
        refs.push({ nodeId: id, location: 'onEnter', detail: `onEnter effect in node "${node.name || id}"` });
      }
    }
  }

  return refs;
}

/**
 * Returns all nodes reachable from the start node.
 * Re-export of findReachableNodes from validation.ts.
 */
export function getReachableNodes(story: Story): Set<string> {
  return findReachableNodes(story);
}

// =============================================================================
// REFACTORING
// =============================================================================

/**
 * Renames a node ID across the entire story.
 * Updates all choice.next references, visited/notVisited conditions, and manifest.startNode.
 */
export function renameNodeId(
  story: Story,
  oldId: string,
  newId: string
): EditorResult {
  if (!story.nodes[oldId]) {
    return { success: false, story, error: `Node "${oldId}" not found` };
  }
  if (story.nodes[newId]) {
    return { success: false, story, error: `Node "${newId}" already exists` };
  }
  if (oldId === newId) {
    return { success: true, story };
  }

  // Build new nodes record
  const newNodes: Record<string, StoryNode> = {};
  for (const [id, node] of Object.entries(story.nodes)) {
    const nodeKey = id === oldId ? newId : id;
    const updatedNode = id === oldId ? { ...node, id: newId } : { ...node };

    if (isDialogueNode(updatedNode)) {
      // Update choice.next references
      updatedNode.choices = updatedNode.choices.map((choice) => {
        let updated = choice;
        if (choice.next === oldId) {
          updated = { ...updated, next: newId };
        }
        // Update visited/notVisited conditions
        if (choice.condition) {
          updated = { ...updated, condition: rewriteNodeCondition(choice.condition, oldId, newId) };
        }
        return updated;
      });
    } else if (updatedNode.type === 'characterCreation' && updatedNode.next === oldId) {
      newNodes[nodeKey] = { ...updatedNode, next: newId };
      continue;
    }

    newNodes[nodeKey] = updatedNode;
  }

  // Update manifest.startNode
  const manifest = story.manifest.startNode === oldId
    ? { ...story.manifest, startNode: newId }
    : story.manifest;

  return {
    success: true,
    story: { ...story, nodes: newNodes, manifest },
  };
}

/**
 * Rewrites node ID references in conditions.
 */
function rewriteNodeCondition(condition: Condition, oldId: string, newId: string): Condition {
  switch (condition.type) {
    case 'visited':
      return condition.nodeId === oldId ? { ...condition, nodeId: newId } : condition;
    case 'notVisited':
      return condition.nodeId === oldId ? { ...condition, nodeId: newId } : condition;
    case 'and':
      return { ...condition, conditions: condition.conditions.map((c) => rewriteNodeCondition(c, oldId, newId)) };
    case 'or':
      return { ...condition, conditions: condition.conditions.map((c) => rewriteNodeCondition(c, oldId, newId)) };
    case 'not':
      return { ...condition, condition: rewriteNodeCondition(condition.condition, oldId, newId) };
    default:
      return condition;
  }
}

/**
 * Renames an entity ID across the entire story.
 * Updates all conditions, effects, manifest starting lists, companions, ability costs.
 */
export function renameEntityId<K extends EntityType>(
  story: Story,
  entityType: K,
  oldId: string,
  newId: string
): EditorResult {
  const collection = getCollection(story, entityType);
  if (!collection[oldId]) {
    return { success: false, story, error: `${entityType} "${oldId}" not found` };
  }
  if (collection[newId]) {
    return { success: false, story, error: `${entityType} "${newId}" already exists` };
  }
  if (oldId === newId) {
    return { success: true, story };
  }

  // Move entity in collection
  const newCollection = { ...collection };
  const entity = newCollection[oldId]!;
  delete newCollection[oldId];
  newCollection[newId] = { ...entity, id: newId } as EntityTypeMap[K];

  let newStory = setCollection(story, entityType, newCollection);

  // Rewrite all node conditions/effects
  newStory = { ...newStory, nodes: rewriteAllNodes(newStory, entityType, oldId, newId) };

  // Rewrite manifest starting lists
  newStory = rewriteManifestReferences(newStory, entityType, oldId, newId);

  // Rewrite cross-references
  newStory = rewriteCrossReferences(newStory, entityType, oldId, newId);

  return { success: true, story: newStory };
}

/**
 * Rewrites manifest starting list references.
 */
function rewriteManifestReferences(story: Story, entityType: EntityType, oldId: string, newId: string): Story {
  const m = { ...story.manifest };

  if (entityType === 'items' && m.startingItems) {
    m.startingItems = m.startingItems.map((s) =>
      s.itemId === oldId ? { ...s, itemId: newId } : s
    );
  }
  if (entityType === 'abilities' && m.startingAbilities) {
    m.startingAbilities = m.startingAbilities.map((id) => id === oldId ? newId : id);
  }
  if (entityType === 'traits' && m.startingTraits) {
    m.startingTraits = m.startingTraits.map((id) => id === oldId ? newId : id);
  }
  if (entityType === 'companions' && m.startingCompanions) {
    m.startingCompanions = m.startingCompanions.map((id) => id === oldId ? newId : id);
  }

  return { ...story, manifest: m };
}

/**
 * Rewrites cross-references between entity types (companions, abilities).
 */
function rewriteCrossReferences(story: Story, entityType: EntityType, oldId: string, newId: string): Story {
  let result = story;

  if (entityType === 'attributes') {
    // Rewrite companion baseAttributes
    if (result.companions) {
      const newCompanions: Record<string, CompanionDefinition> = {};
      for (const [id, comp] of Object.entries(result.companions)) {
        if (comp.baseAttributes && oldId in comp.baseAttributes) {
          const newBase = { ...comp.baseAttributes };
          newBase[newId] = newBase[oldId]!;
          delete newBase[oldId];
          newCompanions[id] = { ...comp, baseAttributes: newBase };
        } else {
          newCompanions[id] = comp;
        }
      }
      result = { ...result, companions: newCompanions };
    }
  }

  if (entityType === 'resources') {
    // Rewrite ability costs
    if (result.abilities) {
      const newAbilities: Record<string, Ability> = {};
      for (const [id, ability] of Object.entries(result.abilities)) {
        if (ability.cost?.resource === oldId) {
          newAbilities[id] = { ...ability, cost: { ...ability.cost, resource: newId } };
        } else {
          newAbilities[id] = ability;
        }
      }
      result = { ...result, abilities: newAbilities };
    }

    // Rewrite companion baseResources
    if (result.companions) {
      const newCompanions: Record<string, CompanionDefinition> = {};
      for (const [id, comp] of Object.entries(result.companions)) {
        if (comp.baseResources && oldId in comp.baseResources) {
          const newBase = { ...comp.baseResources };
          newBase[newId] = newBase[oldId]!;
          delete newBase[oldId];
          newCompanions[id] = { ...comp, baseResources: newBase };
        } else {
          newCompanions[id] = comp;
        }
      }
      result = { ...result, companions: newCompanions };
    }
  }

  return result;
}

// =============================================================================
// MANIFEST HELPERS
// =============================================================================

/**
 * Updates the game manifest with partial changes.
 * Cannot change the game ID.
 */
export function updateManifest(
  story: Story,
  updates: Partial<Omit<GameManifest, 'id'>>
): EditorResult {
  return {
    success: true,
    story: {
      ...story,
      manifest: { ...story.manifest, ...updates },
    },
  };
}

/**
 * Updates the character creation schema.
 */
export function updateCharacterCreation(
  story: Story,
  updates: Partial<CharacterCreationSchema> | undefined
): EditorResult {
  return {
    success: true,
    story: {
      ...story,
      characterCreation: updates === undefined
        ? undefined
        : { ...story.characterCreation, method: 'point-buy', ...updates },
    },
  };
}

/**
 * Sets the start node for the game.
 * Validates that the node exists.
 */
export function setStartNode(
  story: Story,
  nodeId: string
): EditorResult {
  if (!story.nodes[nodeId]) {
    return { success: false, story, error: `Node "${nodeId}" not found` };
  }

  return {
    success: true,
    story: {
      ...story,
      manifest: { ...story.manifest, startNode: nodeId },
    },
  };
}

// =============================================================================
// REGION COMMENTS
// =============================================================================

/**
 * Adds a region comment to the canvas.
 */
export function addRegionComment(
  story: Story,
  comment: Omit<RegionComment, 'id'> & { id?: string }
): EditorResult & { commentId?: string } {
  const existing = new Set((story.regionComments ?? []).map((c) => c.id));
  const id = comment.id && !existing.has(comment.id)
    ? comment.id
    : generatePrefixedId('region', existing);

  const newComment: RegionComment = { ...comment, id };
  return {
    success: true,
    story: {
      ...story,
      regionComments: [...(story.regionComments ?? []), newComment],
    },
    commentId: id,
  };
}

/**
 * Updates an existing region comment.
 */
export function updateRegionComment(
  story: Story,
  commentId: string,
  updates: Partial<Omit<RegionComment, 'id'>>
): EditorResult {
  const comments = story.regionComments ?? [];
  const index = comments.findIndex((c) => c.id === commentId);
  if (index === -1) {
    return { success: false, story, error: `Region comment "${commentId}" not found` };
  }

  const updated = [...comments];
  updated[index] = { ...updated[index]!, ...updates };

  return {
    success: true,
    story: { ...story, regionComments: updated },
  };
}

/**
 * Removes a region comment.
 */
export function removeRegionComment(
  story: Story,
  commentId: string
): EditorResult {
  const comments = story.regionComments ?? [];
  const filtered = comments.filter((c) => c.id !== commentId);
  if (filtered.length === comments.length) {
    return { success: false, story, error: `Region comment "${commentId}" not found` };
  }

  return {
    success: true,
    story: { ...story, regionComments: filtered.length > 0 ? filtered : undefined },
  };
}
