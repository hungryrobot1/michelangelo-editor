/**
 * Condition Evaluator
 *
 * Evaluates boolean condition expressions against game state.
 * Used to determine which choices are available.
 */

import type { Condition, GameState } from '../types/index.js';

/**
 * Helper to compare numbers with an operator
 */
function compareNumbers(value: number, operator: '>=' | '>' | '=' | '<' | '<=', target: number): boolean {
  switch (operator) {
    case '>':
      return value > target;
    case '>=':
      return value >= target;
    case '=':
      return value === target;
    case '<':
      return value < target;
    case '<=':
      return value <= target;
    default:
      return false;
  }
}

/**
 * Evaluates a condition against the current game state.
 * Returns true if the condition is met, false otherwise.
 */
export function evaluateCondition(condition: Condition, state: GameState): boolean {
  switch (condition.type) {
    // Node/story conditions
    case 'visited':
      return state.visitedNodes.includes(condition.nodeId);

    case 'notVisited':
      return !state.visitedNodes.includes(condition.nodeId);

    // Companion conditions
    case 'hasCompanion':
      return state.companions.some((c) => c.id === condition.companionId && c.inParty);

    case 'notHasCompanion':
      return !state.companions.some((c) => c.id === condition.companionId && c.inParty);

    case 'companionRelationship': {
      const companion = state.companions.find((c) => c.id === condition.companionId);
      if (!companion) return false;
      return compareNumbers(companion.relationship, condition.operator, condition.value);
    }

    // Trait conditions
    case 'hasTrait':
      return state.player.traits.includes(condition.traitId);

    case 'notHasTrait':
      return !state.player.traits.includes(condition.traitId);

    // Item conditions
    case 'hasItem': {
      const stack = state.player.items.find((i) => i.itemId === condition.itemId);
      if (!stack) return false;
      const requiredQty = condition.quantity ?? 1;
      return stack.quantity >= requiredQty;
    }

    case 'notHasItem':
      return !state.player.items.some((i) => i.itemId === condition.itemId);

    // Ability conditions
    case 'hasAbility':
      return state.player.abilities.includes(condition.abilityId);

    case 'notHasAbility':
      return !state.player.abilities.includes(condition.abilityId);

    // Attribute conditions (string IDs, validated against game schema at load time)
    case 'attribute': {
      const value = state.player.attributes[condition.attribute] ?? 0;
      return compareNumbers(value, condition.operator, condition.value);
    }

    // Resource conditions (string IDs, validated against game schema at load time)
    case 'resource': {
      const value = state.player.resources[condition.resource] ?? 0;
      return compareNumbers(value, condition.operator, condition.value);
    }

    // Logical combinators
    case 'and':
      return condition.conditions.every((c) => evaluateCondition(c, state));

    case 'or':
      return condition.conditions.some((c) => evaluateCondition(c, state));

    case 'not':
      return !evaluateCondition(condition.condition, state);

    default:
      // Exhaustive check - TypeScript will error if we miss a case
      const _exhaustive: never = condition;
      return false;
  }
}

/**
 * Filter choices to only those whose conditions are met.
 */
export function getAvailableChoices<T extends { condition?: Condition }>(
  choices: T[],
  state: GameState
): T[] {
  return choices.filter((choice) => {
    if (!choice.condition) return true;
    return evaluateCondition(choice.condition, state);
  });
}
