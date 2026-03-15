/**
 * EffectBuilder — Modal for creating or editing an Effect.
 *
 * Presents a type selector and then the appropriate fields for that
 * effect type. Works with the full Effect union from the engine types.
 */

import { useState } from 'react';
import type { Effect, Story } from '@engine/types/index.js';

type EffectType = Effect['type'];

const EFFECT_TYPES: { value: EffectType; label: string; group: string }[] = [
  { value: 'modifyAttribute', label: 'Modify Attribute', group: 'Attributes' },
  { value: 'setAttribute', label: 'Set Attribute', group: 'Attributes' },
  { value: 'modifyResource', label: 'Modify Resource', group: 'Resources' },
  { value: 'setResource', label: 'Set Resource', group: 'Resources' },
  { value: 'addItem', label: 'Add Item', group: 'Items' },
  { value: 'removeItem', label: 'Remove Item', group: 'Items' },
  { value: 'addTrait', label: 'Add Trait', group: 'Traits' },
  { value: 'removeTrait', label: 'Remove Trait', group: 'Traits' },
  { value: 'addAbility', label: 'Add Ability', group: 'Abilities' },
  { value: 'removeAbility', label: 'Remove Ability', group: 'Abilities' },
  { value: 'addCompanion', label: 'Add Companion', group: 'Companions' },
  { value: 'removeCompanion', label: 'Remove Companion', group: 'Companions' },
  { value: 'modifyRelationship', label: 'Modify Relationship', group: 'Companions' },
];

interface EffectBuilderProps {
  story: Story;
  existing?: Effect;
  onSave: (effect: Effect) => void;
  onClose: () => void;
}

export function EffectBuilder({ story, existing, onSave, onClose }: EffectBuilderProps) {
  const [effectType, setEffectType] = useState<EffectType>(existing?.type ?? 'modifyAttribute');

  // Field state for all possible effect fields
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
  const [itemId, setItemId] = useState(() => {
    if (existing && 'itemId' in existing) return existing.itemId;
    const items = Object.keys(story.items ?? {});
    return items[0] ?? '';
  });
  const [traitId, setTraitId] = useState(() => {
    if (existing && 'traitId' in existing) return existing.traitId;
    const traits = Object.keys(story.traits ?? {});
    return traits[0] ?? '';
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
  const [delta, setDelta] = useState(() => {
    if (existing && 'delta' in existing) return existing.delta;
    return 1;
  });
  const [value, setValue] = useState(() => {
    if (existing && 'value' in existing) return existing.value as number;
    return 10;
  });
  const [quantity, setQuantity] = useState(() => {
    if (existing && 'quantity' in existing) return existing.quantity ?? 1;
    return 1;
  });

  const attributes = Object.values(story.attributes);
  const resources = Object.values(story.resources);
  const items = Object.values(story.items ?? {});
  const traits = Object.values(story.traits ?? {});
  const abilities = Object.values(story.abilities ?? {});
  const companions = Object.values(story.companions ?? {});

  const buildEffect = (): Effect | null => {
    switch (effectType) {
      case 'modifyAttribute':
        return attribute ? { type: 'modifyAttribute', attribute, delta } : null;
      case 'setAttribute':
        return attribute ? { type: 'setAttribute', attribute, value } : null;
      case 'modifyResource':
        return resource ? { type: 'modifyResource', resource, delta } : null;
      case 'setResource':
        return resource ? { type: 'setResource', resource, value } : null;
      case 'addItem':
        return itemId ? { type: 'addItem', itemId, quantity: quantity > 1 ? quantity : undefined } : null;
      case 'removeItem':
        return itemId ? { type: 'removeItem', itemId, quantity: quantity > 1 ? quantity : undefined } : null;
      case 'addTrait':
        return traitId ? { type: 'addTrait', traitId } : null;
      case 'removeTrait':
        return traitId ? { type: 'removeTrait', traitId } : null;
      case 'addAbility':
        return abilityId ? { type: 'addAbility', abilityId } : null;
      case 'removeAbility':
        return abilityId ? { type: 'removeAbility', abilityId } : null;
      case 'addCompanion':
        return companionId ? { type: 'addCompanion', companionId } : null;
      case 'removeCompanion':
        return companionId ? { type: 'removeCompanion', companionId } : null;
      case 'modifyRelationship':
        return companionId ? { type: 'modifyRelationship', companionId, delta } : null;
      default:
        return null;
    }
  };

  const handleSave = () => {
    const effect = buildEffect();
    if (effect) {
      onSave(effect);
      onClose();
    }
  };

  // Render the appropriate fields for the selected effect type
  const renderFields = () => {
    switch (effectType) {
      case 'modifyAttribute':
      case 'setAttribute':
        return (
          <>
            <div className="field">
              <label className="field-label">Attribute</label>
              <select className="field-select" value={attribute} onChange={(e) => setAttribute(e.target.value)}>
                {attributes.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {effectType === 'modifyAttribute' ? (
              <div className="field">
                <label className="field-label">Delta (+ or -)</label>
                <input className="field-input" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
              </div>
            ) : (
              <div className="field">
                <label className="field-label">Value</label>
                <input className="field-input" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
            )}
          </>
        );

      case 'modifyResource':
      case 'setResource':
        return (
          <>
            <div className="field">
              <label className="field-label">Resource</label>
              <select className="field-select" value={resource} onChange={(e) => setResource(e.target.value)}>
                {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            {effectType === 'modifyResource' ? (
              <div className="field">
                <label className="field-label">Delta (+ or -)</label>
                <input className="field-input" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
              </div>
            ) : (
              <div className="field">
                <label className="field-label">Value</label>
                <input className="field-input" type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
              </div>
            )}
          </>
        );

      case 'addItem':
      case 'removeItem':
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
              <label className="field-label">Quantity</label>
              <input className="field-input" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} min={1} />
            </div>
          </>
        );

      case 'addTrait':
      case 'removeTrait':
        return (
          <div className="field">
            <label className="field-label">Trait</label>
            <select className="field-select" value={traitId} onChange={(e) => setTraitId(e.target.value)}>
              {traits.length === 0 && <option value="">No traits defined</option>}
              {traits.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        );

      case 'addAbility':
      case 'removeAbility':
        return (
          <div className="field">
            <label className="field-label">Ability</label>
            <select className="field-select" value={abilityId} onChange={(e) => setAbilityId(e.target.value)}>
              {abilities.length === 0 && <option value="">No abilities defined</option>}
              {abilities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        );

      case 'addCompanion':
      case 'removeCompanion':
        return (
          <div className="field">
            <label className="field-label">Companion</label>
            <select className="field-select" value={companionId} onChange={(e) => setCompanionId(e.target.value)}>
              {companions.length === 0 && <option value="">No companions defined</option>}
              {companions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        );

      case 'modifyRelationship':
        return (
          <>
            <div className="field">
              <label className="field-label">Companion</label>
              <select className="field-select" value={companionId} onChange={(e) => setCompanionId(e.target.value)}>
                {companions.length === 0 && <option value="">No companions defined</option>}
                {companions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label">Delta (+ or -)</label>
              <input className="field-input" type="number" value={delta} onChange={(e) => setDelta(Number(e.target.value))} />
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
        <div className="dialog-header">{existing ? 'Edit Effect' : 'Add Effect'}</div>
        <div className="dialog-body">
          <div className="field">
            <label className="field-label">Effect Type</label>
            <select
              className="field-select"
              value={effectType}
              onChange={(e) => setEffectType(e.target.value as EffectType)}
            >
              {EFFECT_TYPES.map((et) => (
                <option key={et.value} value={et.value}>{et.label}</option>
              ))}
            </select>
          </div>
          {renderFields()}
        </div>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleSave} disabled={!buildEffect()}>
            {existing ? 'Update' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
