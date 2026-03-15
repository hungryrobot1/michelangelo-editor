/**
 * Story Validation Module
 *
 * Provides utilities for validating game data integrity, finding broken
 * references, orphaned nodes, and other structural issues.
 *
 * Now validates attribute/resource references against the game's own
 * declared schema rather than hardcoded enums.
 */

import type {
  Story,
  StoryNode,
  Choice,
  Condition,
  Effect,
} from '../types/index.js';
import { isDialogueNode } from '../types/index.js';

// =============================================================================
// VALIDATION RESULT TYPES
// =============================================================================

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  /** Severity level */
  severity: ValidationSeverity;

  /** Issue code for programmatic handling */
  code: string;

  /** Human-readable message */
  message: string;

  /** Location context (node ID, choice index, etc.) */
  location?: {
    nodeId?: string;
    choiceIndex?: number;
    field?: string;
  };
}

export interface ValidationResult {
  /** Whether validation passed with no errors (warnings allowed) */
  valid: boolean;

  /** All issues found */
  issues: ValidationIssue[];

  /** Convenience accessors */
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  infos: ValidationIssue[];
}

// =============================================================================
// ID GENERATION
// =============================================================================

/**
 * Generates a unique node ID using UUID v4.
 * Optionally takes an existing set of IDs to ensure uniqueness.
 */
export function generateNodeId(existingIds?: Set<string> | string[]): string {
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds ?? []);

  // Generate UUID v4
  let id = crypto.randomUUID();

  // Extremely unlikely collision, but handle it anyway
  while (existing.has(id)) {
    id = crypto.randomUUID();
  }

  return id;
}

/**
 * Generates a unique ID with an optional human-readable prefix.
 * Useful for creating meaningful IDs like "tavern-abc123" while ensuring uniqueness.
 */
export function generatePrefixedId(prefix: string, existingIds?: Set<string> | string[]): string {
  const existing = existingIds instanceof Set ? existingIds : new Set(existingIds ?? []);

  // Sanitize prefix: lowercase, replace spaces with dashes, remove special chars
  const sanitized = prefix
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 32); // Limit prefix length

  // Generate short random suffix (8 chars from UUID)
  const suffix = crypto.randomUUID().split('-')[0];
  let id = sanitized ? `${sanitized}-${suffix}` : suffix!;

  // Handle collisions
  let counter = 1;
  const baseId = id;
  while (existing.has(id)) {
    id = `${baseId}-${counter}`;
    counter++;
  }

  return id;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function createIssue(
  severity: ValidationSeverity,
  code: string,
  message: string,
  location?: ValidationIssue['location']
): ValidationIssue {
  return { severity, code, message, location };
}

/**
 * Extracts all node IDs referenced in conditions.
 */
export function getConditionNodeRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'visited':
    case 'notVisited':
      refs.push(condition.nodeId);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionNodeRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionNodeRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all item IDs referenced in a condition.
 */
export function getConditionItemRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'hasItem':
    case 'notHasItem':
      refs.push(condition.itemId);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionItemRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionItemRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all ability IDs referenced in a condition.
 */
export function getConditionAbilityRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'hasAbility':
    case 'notHasAbility':
      refs.push(condition.abilityId);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionAbilityRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionAbilityRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all trait IDs referenced in a condition.
 */
export function getConditionTraitRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'hasTrait':
    case 'notHasTrait':
      refs.push(condition.traitId);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionTraitRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionTraitRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all companion IDs referenced in a condition.
 */
export function getConditionCompanionRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'hasCompanion':
    case 'notHasCompanion':
    case 'companionRelationship':
      refs.push(condition.companionId);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionCompanionRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionCompanionRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all attribute IDs referenced in a condition.
 */
export function getConditionAttributeRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'attribute':
      refs.push(condition.attribute);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionAttributeRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionAttributeRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all resource IDs referenced in a condition.
 */
export function getConditionResourceRefs(condition: Condition): string[] {
  const refs: string[] = [];

  switch (condition.type) {
    case 'resource':
      refs.push(condition.resource);
      break;
    case 'and':
    case 'or':
      for (const sub of condition.conditions) {
        refs.push(...getConditionResourceRefs(sub));
      }
      break;
    case 'not':
      refs.push(...getConditionResourceRefs(condition.condition));
      break;
  }

  return refs;
}

/**
 * Extracts all item IDs referenced in effects.
 */
export function getEffectItemRefs(effects: Effect[]): string[] {
  return effects
    .filter((e): e is Effect & { itemId: string } => e.type === 'addItem' || e.type === 'removeItem')
    .map((e) => e.itemId);
}

/**
 * Extracts all ability IDs referenced in effects.
 */
export function getEffectAbilityRefs(effects: Effect[]): string[] {
  return effects
    .filter((e): e is Effect & { abilityId: string } => e.type === 'addAbility' || e.type === 'removeAbility')
    .map((e) => e.abilityId);
}

/**
 * Extracts all trait IDs referenced in effects.
 */
export function getEffectTraitRefs(effects: Effect[]): string[] {
  return effects
    .filter((e): e is Effect & { traitId: string } => e.type === 'addTrait' || e.type === 'removeTrait')
    .map((e) => e.traitId);
}

/**
 * Extracts all companion IDs referenced in effects.
 */
export function getEffectCompanionRefs(effects: Effect[]): string[] {
  return effects
    .filter(
      (e): e is Effect & { companionId: string } =>
        e.type === 'addCompanion' || e.type === 'removeCompanion' || e.type === 'modifyRelationship'
    )
    .map((e) => e.companionId);
}

/**
 * Extracts all attribute IDs referenced in effects.
 */
export function getEffectAttributeRefs(effects: Effect[]): string[] {
  return effects
    .filter(
      (e): e is Effect & { attribute: string } =>
        e.type === 'modifyAttribute' || e.type === 'setAttribute'
    )
    .map((e) => e.attribute);
}

/**
 * Extracts all resource IDs referenced in effects.
 */
export function getEffectResourceRefs(effects: Effect[]): string[] {
  return effects
    .filter(
      (e): e is Effect & { resource: string } =>
        e.type === 'modifyResource' || e.type === 'setResource'
    )
    .map((e) => e.resource);
}

// =============================================================================
// REACHABILITY ANALYSIS
// =============================================================================

/**
 * Finds all nodes reachable from the start node via choices.
 */
export function findReachableNodes(story: Story): Set<string> {
  const reachable = new Set<string>();
  const queue: string[] = [story.manifest.startNode];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (reachable.has(nodeId)) continue;

    const node = story.nodes[nodeId];
    if (!node) continue;

    reachable.add(nodeId);

    if (isDialogueNode(node)) {
      for (const choice of node.choices) {
        if (!reachable.has(choice.next)) {
          queue.push(choice.next);
        }
      }
    } else if (node.type === 'characterCreation') {
      if (!reachable.has(node.next)) {
        queue.push(node.next);
      }
    }
  }

  return reachable;
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

export interface ValidateOptions {
  /** Whether to check for orphaned nodes (default: true) */
  checkOrphans?: boolean;

  /** Whether to check for undefined references (default: true) */
  checkReferences?: boolean;

  /** Whether to check for empty choices (default: true) */
  checkEmptyChoices?: boolean;
}

/**
 * Validates a complete story for structural integrity.
 */
export function validateStory(story: Story, options: ValidateOptions = {}): ValidationResult {
  const {
    checkOrphans = true,
    checkReferences = true,
    checkEmptyChoices = true,
  } = options;

  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(Object.keys(story.nodes));
  const itemIds = new Set(Object.keys(story.items ?? {}));
  const abilityIds = new Set(Object.keys(story.abilities ?? {}));
  const traitIds = new Set(Object.keys(story.traits ?? {}));
  const companionIds = new Set(Object.keys(story.companions ?? {}));
  const attributeIds = new Set(Object.keys(story.attributes));
  const resourceIds = new Set(Object.keys(story.resources));

  // Check for start node existence
  if (!story.nodes[story.manifest.startNode]) {
    issues.push(
      createIssue(
        'error',
        'MISSING_START_NODE',
        `Start node "${story.manifest.startNode}" does not exist`,
        { field: 'manifest.startNode' }
      )
    );
  }

  // Validate schema: must have at least one attribute defined
  if (attributeIds.size === 0) {
    issues.push(
      createIssue(
        'warning',
        'NO_ATTRIBUTES',
        'No attributes defined — character creation will have nothing to allocate',
        { field: 'attributes' }
      )
    );
  }

  // Validate ability resource costs reference defined resources
  if (checkReferences) {
    for (const ability of Object.values(story.abilities ?? {})) {
      if (ability.cost && !resourceIds.has(ability.cost.resource)) {
        issues.push(
          createIssue(
            'error',
            'UNDEFINED_RESOURCE',
            `Ability "${ability.name}" costs undefined resource "${ability.cost.resource}"`,
            { field: 'abilities' }
          )
        );
      }
    }

    // Validate companion base attribute/resource references
    for (const companion of Object.values(story.companions ?? {})) {
      if (companion.baseAttributes) {
        for (const attrId of Object.keys(companion.baseAttributes)) {
          if (!attributeIds.has(attrId)) {
            issues.push(
              createIssue(
                'error',
                'UNDEFINED_ATTRIBUTE',
                `Companion "${companion.name}" references undefined attribute "${attrId}"`,
                { field: 'companions' }
              )
            );
          }
        }
      }
      if (companion.baseResources) {
        for (const resId of Object.keys(companion.baseResources)) {
          if (!resourceIds.has(resId)) {
            issues.push(
              createIssue(
                'error',
                'UNDEFINED_RESOURCE',
                `Companion "${companion.name}" references undefined resource "${resId}"`,
                { field: 'companions' }
              )
            );
          }
        }
      }
    }
  }

  // Check each node
  for (const [nodeId, node] of Object.entries(story.nodes)) {
    // Validate onEnter effects (common to all node types)
    if (checkReferences && node.onEnter) {
      validateEffectRefs(node.onEnter, nodeId, undefined, issues, {
        itemIds,
        abilityIds,
        traitIds,
        companionIds,
        attributeIds,
        resourceIds,
      });
    }

    // Type-specific validation
    if (isDialogueNode(node)) {
      // Empty text warning
      if (!node.text || node.text.trim().length === 0) {
        issues.push(
          createIssue(
            'warning',
            'EMPTY_NODE_TEXT',
            `Node has no text content`,
            { nodeId }
          )
        );
      }

      // Check for terminal nodes with no choices (info, not error - could be intentional)
      if (checkEmptyChoices && node.choices.length === 0 && nodeId !== story.manifest.startNode) {
        issues.push(
          createIssue(
            'info',
            'TERMINAL_NODE',
            `Node has no choices (terminal/ending node)`,
            { nodeId }
          )
        );
      }

      // Check each choice
      for (let i = 0; i < node.choices.length; i++) {
        const choice = node.choices[i]!;

        // Broken link
        if (!nodeIds.has(choice.next)) {
          issues.push(
            createIssue(
              'error',
              'BROKEN_LINK',
              `Choice links to non-existent node "${choice.next}"`,
              { nodeId, choiceIndex: i, field: 'next' }
            )
          );
        }

        // Self-referential choice (warning)
        if (choice.next === nodeId) {
          issues.push(
            createIssue(
              'warning',
              'SELF_REFERENCE',
              `Choice links back to the same node`,
              { nodeId, choiceIndex: i }
            )
          );
        }

        // Empty choice text
        if (!choice.text || choice.text.trim().length === 0) {
          issues.push(
            createIssue(
              'warning',
              'EMPTY_CHOICE_TEXT',
              `Choice has no text`,
              { nodeId, choiceIndex: i, field: 'text' }
            )
          );
        }

        // Check condition references
        if (checkReferences && choice.condition) {
          validateConditionRefs(choice.condition, nodeId, i, issues, {
            nodeIds,
            itemIds,
            abilityIds,
            traitIds,
            companionIds,
            attributeIds,
            resourceIds,
          });
        }

        // Check effect references
        if (checkReferences && choice.effects) {
          validateEffectRefs(choice.effects, nodeId, i, issues, {
            itemIds,
            abilityIds,
            traitIds,
            companionIds,
            attributeIds,
            resourceIds,
          });
        }

        // Check requiresAbility reference
        if (checkReferences && choice.requiresAbility && !abilityIds.has(choice.requiresAbility)) {
          issues.push(
            createIssue(
              'error',
              'UNDEFINED_ABILITY',
              `Choice requires undefined ability "${choice.requiresAbility}"`,
              { nodeId, choiceIndex: i, field: 'requiresAbility' }
            )
          );
        }
      }
    } else if (node.type === 'characterCreation') {
      // Character creation node: validate that 'next' points to a valid node
      if (!nodeIds.has(node.next)) {
        issues.push(
          createIssue(
            'error',
            'BROKEN_LINK',
            `Character creation node links to non-existent node "${node.next}"`,
            { nodeId, field: 'next' }
          )
        );
      }
    }
  }

  // Check for orphaned nodes
  if (checkOrphans) {
    const reachable = findReachableNodes(story);
    for (const nodeId of nodeIds) {
      if (!reachable.has(nodeId)) {
        issues.push(
          createIssue(
            'warning',
            'ORPHANED_NODE',
            `Node is not reachable from the start node`,
            { nodeId }
          )
        );
      }
    }
  }

  // Check manifest references
  if (checkReferences) {
    // Starting items
    for (const stack of story.manifest.startingItems ?? []) {
      if (!itemIds.has(stack.itemId)) {
        issues.push(
          createIssue(
            'error',
            'UNDEFINED_ITEM',
            `Starting item "${stack.itemId}" is not defined`,
            { field: 'manifest.startingItems' }
          )
        );
      }
    }

    // Starting abilities
    for (const abilityId of story.manifest.startingAbilities ?? []) {
      if (!abilityIds.has(abilityId)) {
        issues.push(
          createIssue(
            'error',
            'UNDEFINED_ABILITY',
            `Starting ability "${abilityId}" is not defined`,
            { field: 'manifest.startingAbilities' }
          )
        );
      }
    }

    // Starting traits
    for (const traitId of story.manifest.startingTraits ?? []) {
      if (!traitIds.has(traitId)) {
        issues.push(
          createIssue(
            'error',
            'UNDEFINED_TRAIT',
            `Starting trait "${traitId}" is not defined`,
            { field: 'manifest.startingTraits' }
          )
        );
      }
    }

    // Starting companions
    for (const companionId of story.manifest.startingCompanions ?? []) {
      if (!companionIds.has(companionId)) {
        issues.push(
          createIssue(
            'error',
            'UNDEFINED_COMPANION',
            `Starting companion "${companionId}" is not defined`,
            { field: 'manifest.startingCompanions' }
          )
        );
      }
    }
  }

  // Sort by severity (errors first)
  const severityOrder: Record<ValidationSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
    infos,
  };
}

interface RefSets {
  nodeIds?: Set<string>;
  itemIds: Set<string>;
  abilityIds: Set<string>;
  traitIds: Set<string>;
  companionIds: Set<string>;
  attributeIds: Set<string>;
  resourceIds: Set<string>;
}

function validateConditionRefs(
  condition: Condition,
  nodeId: string,
  choiceIndex: number | undefined,
  issues: ValidationIssue[],
  refs: RefSets
): void {
  // Node references
  if (refs.nodeIds) {
    for (const ref of getConditionNodeRefs(condition)) {
      if (!refs.nodeIds.has(ref)) {
        issues.push(
          createIssue(
            'error',
            'UNDEFINED_NODE',
            `Condition references undefined node "${ref}"`,
            { nodeId, choiceIndex, field: 'condition' }
          )
        );
      }
    }
  }

  // Item references
  for (const ref of getConditionItemRefs(condition)) {
    if (!refs.itemIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_ITEM',
          `Condition references undefined item "${ref}"`,
          { nodeId, choiceIndex, field: 'condition' }
        )
      );
    }
  }

  // Ability references
  for (const ref of getConditionAbilityRefs(condition)) {
    if (!refs.abilityIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_ABILITY',
          `Condition references undefined ability "${ref}"`,
          { nodeId, choiceIndex, field: 'condition' }
        )
      );
    }
  }

  // Trait references
  for (const ref of getConditionTraitRefs(condition)) {
    if (!refs.traitIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_TRAIT',
          `Condition references undefined trait "${ref}"`,
          { nodeId, choiceIndex, field: 'condition' }
        )
      );
    }
  }

  // Companion references
  for (const ref of getConditionCompanionRefs(condition)) {
    if (!refs.companionIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_COMPANION',
          `Condition references undefined companion "${ref}"`,
          { nodeId, choiceIndex, field: 'condition' }
        )
      );
    }
  }

  // Attribute references
  for (const ref of getConditionAttributeRefs(condition)) {
    if (!refs.attributeIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_ATTRIBUTE',
          `Condition references undefined attribute "${ref}"`,
          { nodeId, choiceIndex, field: 'condition' }
        )
      );
    }
  }

  // Resource references
  for (const ref of getConditionResourceRefs(condition)) {
    if (!refs.resourceIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_RESOURCE',
          `Condition references undefined resource "${ref}"`,
          { nodeId, choiceIndex, field: 'condition' }
        )
      );
    }
  }
}

function validateEffectRefs(
  effects: Effect[],
  nodeId: string,
  choiceIndex: number | undefined,
  issues: ValidationIssue[],
  refs: Omit<RefSets, 'nodeIds'>
): void {
  const fieldName = choiceIndex !== undefined ? 'effects' : 'onEnter';

  // Item references
  for (const ref of getEffectItemRefs(effects)) {
    if (!refs.itemIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_ITEM',
          `Effect references undefined item "${ref}"`,
          { nodeId, choiceIndex, field: fieldName }
        )
      );
    }
  }

  // Ability references
  for (const ref of getEffectAbilityRefs(effects)) {
    if (!refs.abilityIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_ABILITY',
          `Effect references undefined ability "${ref}"`,
          { nodeId, choiceIndex, field: fieldName }
        )
      );
    }
  }

  // Trait references
  for (const ref of getEffectTraitRefs(effects)) {
    if (!refs.traitIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_TRAIT',
          `Effect references undefined trait "${ref}"`,
          { nodeId, choiceIndex, field: fieldName }
        )
      );
    }
  }

  // Companion references
  for (const ref of getEffectCompanionRefs(effects)) {
    if (!refs.companionIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_COMPANION',
          `Effect references undefined companion "${ref}"`,
          { nodeId, choiceIndex, field: fieldName }
        )
      );
    }
  }

  // Attribute references
  for (const ref of getEffectAttributeRefs(effects)) {
    if (!refs.attributeIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_ATTRIBUTE',
          `Effect references undefined attribute "${ref}"`,
          { nodeId, choiceIndex, field: fieldName }
        )
      );
    }
  }

  // Resource references
  for (const ref of getEffectResourceRefs(effects)) {
    if (!refs.resourceIds.has(ref)) {
      issues.push(
        createIssue(
          'error',
          'UNDEFINED_RESOURCE',
          `Effect references undefined resource "${ref}"`,
          { nodeId, choiceIndex, field: fieldName }
        )
      );
    }
  }
}

// =============================================================================
// QUICK VALIDATION HELPERS
// =============================================================================

/**
 * Checks if a story has any validation errors (ignores warnings).
 */
export function isStoryValid(story: Story): boolean {
  return validateStory(story).valid;
}

/**
 * Gets just the error messages from validation.
 */
export function getStoryErrors(story: Story): string[] {
  return validateStory(story).errors.map((e) => e.message);
}

/**
 * Validates a single node in the context of a story.
 * Useful for incremental validation in an editor.
 */
export function validateNode(node: StoryNode, story: Story): ValidationResult {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(Object.keys(story.nodes));
  const itemIds = new Set(Object.keys(story.items ?? {}));
  const abilityIds = new Set(Object.keys(story.abilities ?? {}));
  const traitIds = new Set(Object.keys(story.traits ?? {}));
  const companionIds = new Set(Object.keys(story.companions ?? {}));
  const attributeIds = new Set(Object.keys(story.attributes));
  const resourceIds = new Set(Object.keys(story.resources));

  // Common: onEnter effects
  if (node.onEnter) {
    validateEffectRefs(node.onEnter, node.id, undefined, issues, {
      itemIds,
      abilityIds,
      traitIds,
      companionIds,
      attributeIds,
      resourceIds,
    });
  }

  if (isDialogueNode(node)) {
    // Empty text
    if (!node.text || node.text.trim().length === 0) {
      issues.push(
        createIssue('warning', 'EMPTY_NODE_TEXT', 'Node has no text content', { nodeId: node.id })
      );
    }

    // Check choices
    for (let i = 0; i < node.choices.length; i++) {
      const choice = node.choices[i]!;

      if (!nodeIds.has(choice.next)) {
        issues.push(
          createIssue(
            'error',
            'BROKEN_LINK',
            `Choice links to non-existent node "${choice.next}"`,
            { nodeId: node.id, choiceIndex: i, field: 'next' }
          )
        );
      }

      if (!choice.text || choice.text.trim().length === 0) {
        issues.push(
          createIssue(
            'warning',
            'EMPTY_CHOICE_TEXT',
            'Choice has no text',
            { nodeId: node.id, choiceIndex: i, field: 'text' }
          )
        );
      }

      if (choice.condition) {
        validateConditionRefs(choice.condition, node.id, i, issues, {
          nodeIds,
          itemIds,
          abilityIds,
          traitIds,
          companionIds,
          attributeIds,
          resourceIds,
        });
      }

      if (choice.effects) {
        validateEffectRefs(choice.effects, node.id, i, issues, {
          itemIds,
          abilityIds,
          traitIds,
          companionIds,
          attributeIds,
          resourceIds,
        });
      }
    }
  } else if (node.type === 'characterCreation') {
    if (!nodeIds.has(node.next)) {
      issues.push(
        createIssue(
          'error',
          'BROKEN_LINK',
          `Character creation node links to non-existent node "${node.next}"`,
          { nodeId: node.id, field: 'next' }
        )
      );
    }
  }

  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const infos = issues.filter((i) => i.severity === 'info');

  return {
    valid: errors.length === 0,
    issues,
    errors,
    warnings,
    infos,
  };
}
