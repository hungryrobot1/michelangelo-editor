/**
 * Effect Applicator
 *
 * Applies state changes (effects) to game state.
 * Effects are triggered by entering nodes or making choices.
 *
 * The engine provides generic operations (set, modify) while
 * games define the vocabulary (which attributes/resources exist).
 */

import type {
  Effect,
  GameState,
  Story,
  CompanionCharacter,
} from '../types/index.js';

/**
 * Creates a CompanionCharacter from a companion definition,
 * using the game's attribute/resource schema for defaults.
 */
function createCompanionFromDefinition(
  companionId: string,
  story: Story
): CompanionCharacter | null {
  const def = story.companions?.[companionId];
  if (!def) return null;

  // Build default attributes from game schema
  const defaultAttrs: Record<string, number> = {};
  for (const attrDef of Object.values(story.attributes)) {
    defaultAttrs[attrDef.id] = attrDef.base;
  }

  // Build default resources from game schema
  const defaultRes: Record<string, number> = {};
  for (const resDef of Object.values(story.resources)) {
    defaultRes[resDef.id] = resDef.default;
  }

  return {
    id: def.id,
    name: def.name,
    description: def.description,
    image: def.image,
    attributes: { ...defaultAttrs, ...def.baseAttributes },
    resources: { ...defaultRes, ...def.baseResources },
    items: [],
    abilities: def.startingAbilities ?? [],
    traits: def.startingTraits ?? [],
    relationship: def.startingRelationship ?? 0,
    inParty: true,
  };
}

/**
 * Clamps a value to the min/max defined for an attribute.
 */
function clampAttribute(value: number, attributeId: string, story: Story): number {
  const def = story.attributes[attributeId];
  if (!def) return value;
  if (def.min !== undefined && value < def.min) return def.min;
  if (def.max !== undefined && value > def.max) return def.max;
  return value;
}

/**
 * Clamps a value to the min/max defined for a resource.
 */
function clampResource(value: number, resourceId: string, story: Story): number {
  const def = story.resources[resourceId];
  if (!def) return Math.max(0, value);
  const min = def.min ?? 0;
  if (value < min) return min;
  if (def.max !== undefined && value > def.max) return def.max;
  return value;
}

/**
 * Applies an effect to the game state, returning a new state object.
 * State is immutable - this always returns a new object.
 */
export function applyEffect(effect: Effect, state: GameState, story: Story): GameState {
  switch (effect.type) {
    // Trait effects
    case 'addTrait':
      if (state.player.traits.includes(effect.traitId)) {
        return state;
      }
      return {
        ...state,
        player: {
          ...state.player,
          traits: [...state.player.traits, effect.traitId],
        },
      };

    case 'removeTrait':
      return {
        ...state,
        player: {
          ...state.player,
          traits: state.player.traits.filter((t) => t !== effect.traitId),
        },
      };

    // Companion effects
    case 'addCompanion': {
      // Check if already in party
      const existing = state.companions.find((c) => c.id === effect.companionId);
      if (existing?.inParty) {
        return state;
      }

      // If companion exists but not in party, set inParty to true
      if (existing) {
        return {
          ...state,
          companions: state.companions.map((c) =>
            c.id === effect.companionId ? { ...c, inParty: true } : c
          ),
        };
      }

      // Create new companion from definition
      const newCompanion = createCompanionFromDefinition(effect.companionId, story);
      if (!newCompanion) {
        console.warn(`Companion definition not found: ${effect.companionId}`);
        return state;
      }

      return {
        ...state,
        companions: [...state.companions, newCompanion],
      };
    }

    case 'removeCompanion':
      return {
        ...state,
        companions: state.companions.map((c) =>
          c.id === effect.companionId ? { ...c, inParty: false } : c
        ),
      };

    case 'modifyRelationship': {
      const companion = state.companions.find((c) => c.id === effect.companionId);
      if (!companion) return state;

      const newRelationship = Math.max(-100, Math.min(100, companion.relationship + effect.delta));
      return {
        ...state,
        companions: state.companions.map((c) =>
          c.id === effect.companionId ? { ...c, relationship: newRelationship } : c
        ),
      };
    }

    // Attribute effects
    case 'modifyAttribute': {
      const currentAttr = state.player.attributes[effect.attribute] ?? 0;
      const newValue = clampAttribute(currentAttr + effect.delta, effect.attribute, story);
      return {
        ...state,
        player: {
          ...state.player,
          attributes: {
            ...state.player.attributes,
            [effect.attribute]: newValue,
          },
        },
      };
    }

    case 'setAttribute': {
      const clampedValue = clampAttribute(effect.value, effect.attribute, story);
      return {
        ...state,
        player: {
          ...state.player,
          attributes: {
            ...state.player.attributes,
            [effect.attribute]: clampedValue,
          },
        },
      };
    }

    // Resource effects
    case 'modifyResource': {
      const currentRes = state.player.resources[effect.resource] ?? 0;
      const newValue = clampResource(currentRes + effect.delta, effect.resource, story);
      return {
        ...state,
        player: {
          ...state.player,
          resources: {
            ...state.player.resources,
            [effect.resource]: newValue,
          },
        },
      };
    }

    case 'setResource': {
      const clampedValue = clampResource(effect.value, effect.resource, story);
      return {
        ...state,
        player: {
          ...state.player,
          resources: {
            ...state.player.resources,
            [effect.resource]: clampedValue,
          },
        },
      };
    }

    // Item effects
    case 'addItem': {
      const quantity = effect.quantity ?? 1;
      const existingIndex = state.player.items.findIndex((i) => i.itemId === effect.itemId);

      if (existingIndex >= 0) {
        // Add to existing stack
        const newItems = [...state.player.items];
        const existing = newItems[existingIndex];
        if (existing) {
          newItems[existingIndex] = {
            ...existing,
            quantity: existing.quantity + quantity,
          };
        }
        return {
          ...state,
          player: { ...state.player, items: newItems },
        };
      } else {
        // Create new stack
        return {
          ...state,
          player: {
            ...state.player,
            items: [...state.player.items, { itemId: effect.itemId, quantity }],
          },
        };
      }
    }

    case 'removeItem': {
      const quantity = effect.quantity ?? 1;
      const existingIndex = state.player.items.findIndex((i) => i.itemId === effect.itemId);

      if (existingIndex < 0) return state;

      const existing = state.player.items[existingIndex];
      if (!existing) return state;

      if (existing.quantity <= quantity) {
        // Remove entire stack
        return {
          ...state,
          player: {
            ...state.player,
            items: state.player.items.filter((i) => i.itemId !== effect.itemId),
          },
        };
      } else {
        // Reduce quantity
        const newItems = [...state.player.items];
        newItems[existingIndex] = {
          ...existing,
          quantity: existing.quantity - quantity,
        };
        return {
          ...state,
          player: { ...state.player, items: newItems },
        };
      }
    }

    // Ability effects
    case 'addAbility':
      if (state.player.abilities.includes(effect.abilityId)) {
        return state;
      }
      return {
        ...state,
        player: {
          ...state.player,
          abilities: [...state.player.abilities, effect.abilityId],
        },
      };

    case 'removeAbility':
      return {
        ...state,
        player: {
          ...state.player,
          abilities: state.player.abilities.filter((a) => a !== effect.abilityId),
        },
      };

    default:
      const _exhaustive: never = effect;
      return state;
  }
}

/**
 * Applies multiple effects in sequence.
 */
export function applyEffects(effects: Effect[], state: GameState, story: Story): GameState {
  return effects.reduce((currentState, effect) => applyEffect(effect, currentState, story), state);
}

/**
 * Returns a human-readable description of an effect.
 * Uses the story's entity definitions for display names.
 */
export function describeEffect(effect: Effect, story: Story): string {
  switch (effect.type) {
    case 'addTrait': {
      const name = story.traits?.[effect.traitId]?.name ?? effect.traitId;
      return `Gained trait: ${name}`;
    }
    case 'removeTrait': {
      const name = story.traits?.[effect.traitId]?.name ?? effect.traitId;
      return `Lost trait: ${name}`;
    }
    case 'addCompanion': {
      const name = story.companions?.[effect.companionId]?.name ?? effect.companionId;
      return `${name} joined the party`;
    }
    case 'removeCompanion': {
      const name = story.companions?.[effect.companionId]?.name ?? effect.companionId;
      return `${name} left the party`;
    }
    case 'modifyRelationship': {
      const name = story.companions?.[effect.companionId]?.name ?? effect.companionId;
      const sign = effect.delta > 0 ? '+' : '';
      return `${name} relationship ${sign}${effect.delta}`;
    }
    case 'modifyAttribute': {
      const name = story.attributes[effect.attribute]?.name ?? effect.attribute;
      const sign = effect.delta > 0 ? '+' : '';
      return `${name} ${sign}${effect.delta}`;
    }
    case 'setAttribute': {
      const name = story.attributes[effect.attribute]?.name ?? effect.attribute;
      return `${name} set to ${effect.value}`;
    }
    case 'modifyResource': {
      const name = story.resources[effect.resource]?.name ?? effect.resource;
      const sign = effect.delta > 0 ? '+' : '';
      return `${name} ${sign}${effect.delta}`;
    }
    case 'setResource': {
      const name = story.resources[effect.resource]?.name ?? effect.resource;
      return `${name} set to ${effect.value}`;
    }
    case 'addItem': {
      const name = story.items?.[effect.itemId]?.name ?? effect.itemId;
      const qty = effect.quantity ?? 1;
      return qty > 1 ? `Received ${name} x${qty}` : `Received ${name}`;
    }
    case 'removeItem': {
      const name = story.items?.[effect.itemId]?.name ?? effect.itemId;
      const qty = effect.quantity ?? 1;
      return qty > 1 ? `Lost ${name} x${qty}` : `Lost ${name}`;
    }
    case 'addAbility': {
      const name = story.abilities?.[effect.abilityId]?.name ?? effect.abilityId;
      return `Learned ability: ${name}`;
    }
    case 'removeAbility': {
      const name = story.abilities?.[effect.abilityId]?.name ?? effect.abilityId;
      return `Lost ability: ${name}`;
    }
    default:
      return 'Unknown effect';
  }
}
