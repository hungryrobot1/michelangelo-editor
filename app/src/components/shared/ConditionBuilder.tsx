/**
 * ConditionBuilder — Modal for creating or editing a Condition.
 *
 * Supports all leaf condition types plus AND/OR/NOT combinators.
 * For simple use cases, a single condition is created. For compound
 * conditions, the user can wrap in AND/OR/NOT.
 */

import { useState } from 'react';
import type { Condition, Story } from '@engine/types/index.js';
import { formatCondition } from './EffectChip';

type ComparisonOperator = '>=' | '>' | '=' | '<' | '<=';

type LeafConditionType =
  | 'visited' | 'notVisited'
  | 'hasTrait' | 'notHasTrait'
  | 'hasItem' | 'notHasItem'
  | 'hasAbility' | 'notHasAbility'
  | 'hasCompanion' | 'notHasCompanion'
  | 'companionRelationship'
  | 'attribute' | 'resource';

const CONDITION_TYPES: { value: LeafConditionType; label: string }[] = [
  { value: 'visited', label: 'Node Visited' },
  { value: 'notVisited', label: 'Node Not Visited' },
  { value: 'attribute', label: 'Attribute Check' },
  { value: 'resource', label: 'Resource Check' },
  { value: 'hasTrait', label: 'Has Trait' },
  { value: 'notHasTrait', label: 'Not Has Trait' },
  { value: 'hasItem', label: 'Has Item' },
  { value: 'notHasItem', label: 'Not Has Item' },
  { value: 'hasAbility', label: 'Has Ability' },
  { value: 'notHasAbility', label: 'Not Has Ability' },
  { value: 'hasCompanion', label: 'Has Companion' },
  { value: 'notHasCompanion', label: 'Not Has Companion' },
  { value: 'companionRelationship', label: 'Companion Relationship' },
];

const OPERATORS: ComparisonOperator[] = ['>=', '>', '=', '<', '<='];

interface ConditionBuilderProps {
  story: Story;
  existing?: Condition;
  onSave: (condition: Condition) => void;
  onClose: () => void;
}

/**
 * Extracts the leaf type from an existing condition (for pre-populating the form).
 * Compound conditions (and/or/not) are displayed as read-only with option to replace.
 */
function getLeafType(condition: Condition): LeafConditionType | null {
  if (condition.type === 'and' || condition.type === 'or' || condition.type === 'not') {
    return null;
  }
  return condition.type as LeafConditionType;
}

export function ConditionBuilder({ story, existing, onSave, onClose }: ConditionBuilderProps) {
  const isCompound = existing && (existing.type === 'and' || existing.type === 'or' || existing.type === 'not');

  const [condType, setCondType] = useState<LeafConditionType>(
    existing ? (getLeafType(existing) ?? 'visited') : 'visited'
  );

  // Field state
  const [nodeId, setNodeId] = useState(() => {
    if (existing && 'nodeId' in existing) return existing.nodeId;
    const ids = Object.keys(story.nodes);
    return ids[0] ?? '';
  });
  const [attribute, setAttribute] = useState(() => {
    if (existing && 'attribute' in existing) return existing.attribute;
    const attrs = Object.keys(story.attributes);
    return attrs[0] ?? '';
  });
  const [resource, setResource] = useState(() => {
    if (existing && 'resource' in existing) return existing.resource;
    const res = Object.keys(story.resources);
    return res[0] ?? '';
  });
  const [traitId, setTraitId] = useState(() => {
    if (existing && 'traitId' in existing) return existing.traitId;
    const traits = Object.keys(story.traits ?? {});
    return traits[0] ?? '';
  });
  const [itemId, setItemId] = useState(() => {
    if (existing && 'itemId' in existing) return existing.itemId;
    const items = Object.keys(story.items ?? {});
    return items[0] ?? '';
  });
  const [abilityId, setAbilityId] = useState(() => {
    if (existing && 'abilityId' in existing) return existing.abilityId;
    const abilities = Object.keys(story.abilities ?? {});
    return abilities[0] ?? '';
  });
  const [companionId, setCompanionId] = useState(() => {
    if (existing && 'companionId' in existing) return existing.companionId;
    const companions = Object.keys(story.companions ?? {});
    return companions[0] ?? '';
  });
  const [operator, setOperator] = useState<ComparisonOperator>(() => {
    if (existing && 'operator' in existing) return existing.operator as ComparisonOperator;
    return '>=';
  });
  const [value, setValue] = useState(() => {
    if (existing && 'value' in existing) return existing.value as number;
    return 1;
  });
  const [quantity, setQuantity] = useState(() => {
    if (existing && 'quantity' in existing && existing.quantity) return existing.quantity;
    return 1;
  });

  const nodeIds = Object.keys(story.nodes);
  const attributes = Object.values(story.attributes);
  const resources = Object.values(story.resources);
  const traits = Object.values(story.traits ?? {});
  const items = Object.values(story.items ?? {});
  const abilities = Object.values(story.abilities ?? {});
  const companions = Object.values(story.companions ?? {});

  const buildCondition = (): Condition | null => {
    switch (condType) {
      case 'visited':
        return nodeId ? { type: 'visited', nodeId } : null;
      case 'notVisited':
        return nodeId ? { type: 'notVisited', nodeId } : null;
      case 'attribute':
        return attribute ? { type: 'attribute', attribute, operator, value } : null;
      case 'resource':
        return resource ? { type: 'resource', resource, operator, value } : null;
      case 'hasTrait':
        return traitId ? { type: 'hasTrait', traitId } : null;
      case 'notHasTrait':
        return traitId ? { type: 'notHasTrait', traitId } : null;
      case 'hasItem':
        return itemId ? { type: 'hasItem', itemId, quantity: quantity > 1 ? quantity : undefined } : null;
      case 'notHasItem':
        return itemId ? { type: 'notHasItem', itemId } : null;
      case 'hasAbility':
        return abilityId ? { type: 'hasAbility', abilityId } : null;
      case 'notHasAbility':
        return abilityId ? { type: 'notHasAbility', abilityId } : null;
      case 'hasCompanion':
        return companionId ? { type: 'hasCompanion', companionId } : null;
      case 'notHasCompanion':
        return companionId ? { type: 'notHasCompanion', companionId } : null;
      case 'companionRelationship':
        return companionId ? { type: 'companionRelationship', companionId, operator, value } : null;
      default:
        return null;
    }
  };

  const handleSave = () => {
    const cond = buildCondition();
    if (cond) {
      onSave(cond);
      onClose();
    }
  };

  const renderFields = () => {
    switch (condType) {
      case 'visited':
      case 'notVisited':
        return (
          <div className="field">
            <label className="field-label">Node</label>
            <select className="field-select" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
              {nodeIds.map((id) => (
                <option key={id} value={id}>{story.nodes[id]?.name || id}</option>
              ))}
            </select>
          </div>
        );

      case 'attribute':
        return (
          <>
            <div className="field">
              <label className="field-label">Attribute</label>
              <select className="field-select" value={attribute} onChange={(e) => setAttribute(e.target.value)}>
                {attributes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Operator</label>
                <select className="field-select" value={operator} onChange={(e) => setOperator(e.target.value as ComparisonOperator)}>
                  {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Value</label>
                <input className="field-input" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
            </div>
          </>
        );

      case 'resource':
        return (
          <>
            <div className="field">
              <label className="field-label">Resource</label>
              <select className="field-select" value={resource} onChange={(e) => setResource(e.target.value)}>
                {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Operator</label>
                <select className="field-select" value={operator} onChange={(e) => setOperator(e.target.value as ComparisonOperator)}>
                  {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Value</label>
                <input className="field-input" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
            </div>
          </>
        );

      case 'hasTrait':
      case 'notHasTrait':
        return (
          <div className="field">
            <label className="field-label">Trait</label>
            <select className="field-select" value={traitId} onChange={(e) => setTraitId(e.target.value)}>
              {traits.length === 0 && <option value="">No traits defined</option>}
              {traits.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        );

      case 'hasItem':
        return (
          <>
            <div className="field">
              <label className="field-label">Item</label>
              <select className="field-select" value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.length === 0 && <option value="">No items defined</option>}
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Min Quantity (optional)</label>
              <input className="field-input" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min={1} />
            </div>
          </>
        );

      case 'notHasItem':
        return (
          <div className="field">
            <label className="field-label">Item</label>
            <select className="field-select" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              {items.length === 0 && <option value="">No items defined</option>}
              {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        );

      case 'hasAbility':
      case 'notHasAbility':
        return (
          <div className="field">
            <label className="field-label">Ability</label>
            <select className="field-select" value={abilityId} onChange={(e) => setAbilityId(e.target.value)}>
              {abilities.length === 0 && <option value="">No abilities defined</option>}
              {abilities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        );

      case 'hasCompanion':
      case 'notHasCompanion':
        return (
          <div className="field">
            <label className="field-label">Companion</label>
            <select className="field-select" value={companionId} onChange={(e) => setCompanionId(e.target.value)}>
              {companions.length === 0 && <option value="">No companions defined</option>}
              {companions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        );

      case 'companionRelationship':
        return (
          <>
            <div className="field">
              <label className="field-label">Companion</label>
              <select className="field-select" value={companionId} onChange={(e) => setCompanionId(e.target.value)}>
                {companions.length === 0 && <option value="">No companions defined</option>}
                {companions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Operator</label>
                <select className="field-select" value={operator} onChange={(e) => setOperator(e.target.value as ComparisonOperator)}>
                  {OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label className="field-label">Value</label>
                <input className="field-input" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">{existing ? 'Edit Condition' : 'Add Condition'}</div>
        <div className="dialog-body">
          {isCompound && (
            <div style={{ marginBottom: 12, padding: 8, background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', fontSize: 12 }}>
              <div style={{ color: 'var(--color-text-dim)', marginBottom: 4 }}>Current (compound):</div>
              <span className="effect-chip condition-chip">{formatCondition(existing!)}</span>
              <div style={{ color: 'var(--color-text-dim)', marginTop: 8, fontSize: 11 }}>
                Editing will replace this compound condition with a new one.
              </div>
            </div>
          )}
          <div className="field">
            <label className="field-label">Condition Type</label>
            <select
              className="field-select"
              value={condType}
              onChange={(e) => setCondType(e.target.value as LeafConditionType)}
            >
              {CONDITION_TYPES.map((ct) => (
                <option key={ct.value} value={ct.value}>{ct.label}</option>
              ))}
            </select>
          </div>
          {renderFields()}
        </div>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={!buildCondition()}>
            {existing ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
