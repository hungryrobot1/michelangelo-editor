/**
 * Character Creation Module
 *
 * Provides utilities for creating and validating player characters.
 * Works with game-defined attribute/resource schemas rather than
 * hardcoded attribute sets.
 *
 * This module is platform-agnostic and can be used by any UI.
 */

import type {
  PlayerCharacter,
  AttributeMap,
  ResourceMap,
  Story,
  AttributeDefinition,
  ResourceDefinition,
  CharacterCreationSchema,
} from '../types/index.js';

/**
 * Configuration for character creation, derived from game schema.
 */
export interface CharacterCreationConfig {
  /** Total points available for attribute allocation */
  pointBudget: number;
  /** The game's attribute definitions */
  attributes: AttributeDefinition[];
  /** The game's resource definitions */
  resources: ResourceDefinition[];
  /** Cost curve breakpoints for point-buy */
  costCurve: { threshold: number; cost: number }[];
}

/**
 * Default cost curve: D&D 5e-style point buy.
 * Below threshold 13: 1 point per increase.
 * At 13 and above: 2 points per increase.
 */
const DEFAULT_COST_CURVE = [{ threshold: 13, cost: 2 }];

/**
 * Default point budget when no character creation schema is provided.
 */
const DEFAULT_POINT_BUDGET = 27;

/**
 * Gets character creation config from a story's schema.
 */
export function getCreationConfig(story: Story): CharacterCreationConfig {
  const schema = story.characterCreation;
  const attributes = Object.values(story.attributes);
  const resources = Object.values(story.resources);

  return {
    pointBudget: schema?.pointBudget ?? DEFAULT_POINT_BUDGET,
    attributes,
    resources,
    costCurve: schema?.costCurve ?? DEFAULT_COST_CURVE,
  };
}

/**
 * Creates a blank character with base attributes for point-buy.
 * Attributes start at their definition's base value.
 */
export function createBlankCharacter(config: CharacterCreationConfig): PlayerCharacter {
  const attributes: AttributeMap = {};
  for (const attrDef of config.attributes) {
    attributes[attrDef.id] = attrDef.base;
  }

  const resources: ResourceMap = {};
  for (const resDef of config.resources) {
    resources[resDef.id] = resDef.default;
  }

  return {
    id: 'player',
    name: '',
    attributes,
    resources,
    items: [],
    abilities: [],
    traits: [],
  };
}

/**
 * Creates a default character with base attribute values.
 * Used when character creation is skipped.
 */
export function createDefaultCharacter(story: Story, name: string = 'Adventurer'): PlayerCharacter {
  const config = getCreationConfig(story);
  const character = createBlankCharacter(config);
  character.name = name;
  return character;
}

/**
 * Calculates the point cost for a given attribute value using the cost curve.
 *
 * The cost curve defines thresholds where the per-point cost increases.
 * Below the first threshold: 1 point per increase.
 * At or above a threshold: that threshold's cost per increase.
 */
export function getAttributeCost(
  value: number,
  baseValue: number,
  costCurve: { threshold: number; cost: number }[]
): number {
  if (value <= baseValue) return 0;

  // Sort curve by threshold ascending
  const sorted = [...costCurve].sort((a, b) => a.threshold - b.threshold);

  let total = 0;
  for (let v = baseValue + 1; v <= value; v++) {
    // Find the applicable cost for this value
    let costPerPoint = 1;
    for (const entry of sorted) {
      if (v > entry.threshold) {
        costPerPoint = entry.cost;
      }
    }
    total += costPerPoint;
  }
  return total;
}

/**
 * Calculates the marginal cost to increase an attribute by 1.
 */
export function getIncreaseCost(
  currentValue: number,
  attrDef: AttributeDefinition,
  config: CharacterCreationConfig
): number {
  if (attrDef.max !== undefined && currentValue >= attrDef.max) return Infinity;

  const sorted = [...config.costCurve].sort((a, b) => a.threshold - b.threshold);
  let costPerPoint = 1;
  for (const entry of sorted) {
    if (currentValue + 1 > entry.threshold) {
      costPerPoint = entry.cost;
    }
  }
  return costPerPoint;
}

/**
 * Calculates the points refunded when decreasing an attribute by 1.
 */
export function getDecreaseCost(
  currentValue: number,
  attrDef: AttributeDefinition
): number {
  const min = attrDef.min ?? 0;
  if (currentValue <= min) return 0;
  // The refund is 1 unless we're above a cost curve threshold
  // This is computed by the caller using getIncreaseCost at value-1
  return 1;
}

/**
 * Calculates total points spent on current attributes.
 */
export function calculatePointsSpent(
  attributes: AttributeMap,
  config: CharacterCreationConfig
): number {
  let total = 0;
  for (const attrDef of config.attributes) {
    const value = attributes[attrDef.id] ?? attrDef.base;
    total += getAttributeCost(value, attrDef.base, config.costCurve);
  }
  return total;
}

/**
 * Calculates remaining points available.
 */
export function calculatePointsRemaining(
  attributes: AttributeMap,
  config: CharacterCreationConfig
): number {
  return config.pointBudget - calculatePointsSpent(attributes, config);
}

/**
 * Result of an attribute change attempt.
 */
export interface AttributeChangeResult {
  success: boolean;
  newAttributes?: AttributeMap;
  pointsSpent?: number;
  pointsRemaining?: number;
  error?: string;
}

/**
 * Attempts to increase an attribute by 1.
 * Returns the new attributes if successful, or an error message if not.
 */
export function increaseAttribute(
  attributes: AttributeMap,
  attributeId: string,
  config: CharacterCreationConfig
): AttributeChangeResult {
  const attrDef = config.attributes.find((a) => a.id === attributeId);
  if (!attrDef) {
    return { success: false, error: `Unknown attribute: ${attributeId}` };
  }

  const currentValue = attributes[attributeId] ?? attrDef.base;

  if (attrDef.max !== undefined && currentValue >= attrDef.max) {
    return { success: false, error: `${attrDef.name} is already at maximum (${attrDef.max})` };
  }

  const cost = getIncreaseCost(currentValue, attrDef, config);
  const remaining = calculatePointsRemaining(attributes, config);

  if (cost > remaining) {
    return { success: false, error: 'Not enough points' };
  }

  const newAttributes: AttributeMap = {
    ...attributes,
    [attributeId]: currentValue + 1,
  };

  return {
    success: true,
    newAttributes,
    pointsSpent: calculatePointsSpent(newAttributes, config),
    pointsRemaining: calculatePointsRemaining(newAttributes, config),
  };
}

/**
 * Attempts to decrease an attribute by 1.
 * Returns the new attributes if successful, or an error message if not.
 */
export function decreaseAttribute(
  attributes: AttributeMap,
  attributeId: string,
  config: CharacterCreationConfig
): AttributeChangeResult {
  const attrDef = config.attributes.find((a) => a.id === attributeId);
  if (!attrDef) {
    return { success: false, error: `Unknown attribute: ${attributeId}` };
  }

  const currentValue = attributes[attributeId] ?? attrDef.base;
  const min = attrDef.min ?? 0;

  if (currentValue <= min) {
    return { success: false, error: `${attrDef.name} is already at minimum (${min})` };
  }

  const newAttributes: AttributeMap = {
    ...attributes,
    [attributeId]: currentValue - 1,
  };

  return {
    success: true,
    newAttributes,
    pointsSpent: calculatePointsSpent(newAttributes, config),
    pointsRemaining: calculatePointsRemaining(newAttributes, config),
  };
}

/**
 * Validates a complete character for finalization.
 */
export interface CharacterValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateCharacter(
  character: PlayerCharacter,
  config: CharacterCreationConfig
): CharacterValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check name
  if (!character.name || character.name.trim().length === 0) {
    errors.push('Character must have a name');
  }

  // Check attributes are in valid range
  for (const attrDef of config.attributes) {
    const value = character.attributes[attrDef.id] ?? attrDef.base;
    const min = attrDef.min ?? 0;
    if (value < min) {
      errors.push(`${attrDef.name} (${value}) is below minimum (${min})`);
    }
    if (attrDef.max !== undefined && value > attrDef.max) {
      errors.push(`${attrDef.name} (${value}) is above maximum (${attrDef.max})`);
    }
  }

  // Check points
  const remaining = calculatePointsRemaining(character.attributes, config);
  if (remaining < 0) {
    errors.push(`Spent ${-remaining} more points than allowed`);
  } else if (remaining > 0) {
    warnings.push(`${remaining} points unspent`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Finalizes a character with the given name and optional appearance.
 * Returns a complete PlayerCharacter ready for game start.
 */
export function finalizeCharacter(
  name: string,
  attributes: AttributeMap,
  resources: ResourceMap,
  appearance?: string
): PlayerCharacter {
  return {
    id: 'player',
    name: name.trim(),
    appearance: appearance?.trim() || undefined,
    attributes: { ...attributes },
    resources: { ...resources },
    items: [],
    abilities: [],
    traits: [],
  };
}

