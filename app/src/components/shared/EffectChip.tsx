/**
 * EffectChip — Compact display of an effect or condition.
 *
 * Renders effects/conditions as readable chip/tags.
 * Used on node surfaces and in the inspector.
 */

import type { Effect, Condition } from '@engine/types/index.js';

/**
 * Formats an effect into a compact readable string.
 */
export function formatEffect(effect: Effect): { icon: string; label: string } {
  switch (effect.type) {
    case 'addTrait':
      return { icon: '\u2728', label: `+trait "${effect.traitId}"` };
    case 'removeTrait':
      return { icon: '\u2728', label: `-trait "${effect.traitId}"` };
    case 'addItem':
      return { icon: '\uD83D\uDCE6', label: `+${effect.itemId}${effect.quantity && effect.quantity > 1 ? ` x${effect.quantity}` : ''}` };
    case 'removeItem':
      return { icon: '\uD83D\uDCE6', label: `-${effect.itemId}${effect.quantity && effect.quantity > 1 ? ` x${effect.quantity}` : ''}` };
    case 'addAbility':
      return { icon: '\u2B50', label: `+ability "${effect.abilityId}"` };
    case 'removeAbility':
      return { icon: '\u2B50', label: `-ability "${effect.abilityId}"` };
    case 'modifyAttribute':
      return { icon: '\u26A1', label: `${effect.attribute} ${effect.delta >= 0 ? '+' : ''}${effect.delta}` };
    case 'setAttribute':
      return { icon: '\u26A1', label: `${effect.attribute} = ${effect.value}` };
    case 'modifyResource':
      return { icon: '\u26A1', label: `${effect.resource} ${effect.delta >= 0 ? '+' : ''}${effect.delta}` };
    case 'setResource':
      return { icon: '\u26A1', label: `${effect.resource} = ${effect.value}` };
    case 'addCompanion':
      return { icon: '\uD83D\uDC64', label: `+companion "${effect.companionId}"` };
    case 'removeCompanion':
      return { icon: '\uD83D\uDC64', label: `-companion "${effect.companionId}"` };
    case 'modifyRelationship':
      return { icon: '\u2764\uFE0F', label: `${effect.companionId} ${effect.delta >= 0 ? '+' : ''}${effect.delta}` };
    default:
      return { icon: '\u2753', label: 'unknown effect' };
  }
}

/**
 * Formats a condition into a compact readable string.
 */
export function formatCondition(condition: Condition): string {
  switch (condition.type) {
    case 'visited':
      return `visited "${condition.nodeId}"`;
    case 'notVisited':
      return `!visited "${condition.nodeId}"`;
    case 'hasTrait':
      return `has "${condition.traitId}"`;
    case 'notHasTrait':
      return `!has "${condition.traitId}"`;
    case 'hasItem':
      return `has ${condition.itemId}${condition.quantity ? ` x${condition.quantity}` : ''}`;
    case 'notHasItem':
      return `!has ${condition.itemId}`;
    case 'hasAbility':
      return `knows "${condition.abilityId}"`;
    case 'notHasAbility':
      return `!knows "${condition.abilityId}"`;
    case 'hasCompanion':
      return `with "${condition.companionId}"`;
    case 'notHasCompanion':
      return `!with "${condition.companionId}"`;
    case 'companionRelationship':
      return `${condition.companionId} ${condition.operator} ${condition.value}`;
    case 'attribute':
      return `${condition.attribute} ${condition.operator} ${condition.value}`;
    case 'resource':
      return `${condition.resource} ${condition.operator} ${condition.value}`;
    case 'and':
      return condition.conditions.map(formatCondition).join(' AND ');
    case 'or':
      return condition.conditions.map(formatCondition).join(' OR ');
    case 'not':
      return `NOT (${formatCondition(condition.condition)})`;
    default:
      return '???';
  }
}

export function EffectChipDisplay({ effect }: { effect: Effect }) {
  const { icon, label } = formatEffect(effect);
  return (
    <span className="effect-chip">
      <span className="effect-chip-icon">{icon}</span>
      {label}
    </span>
  );
}

export function ConditionChipDisplay({ condition }: { condition: Condition }) {
  const label = formatCondition(condition);
  return (
    <span className="effect-chip condition-chip">
      <span className="effect-chip-icon">?</span>
      {label}
    </span>
  );
}
