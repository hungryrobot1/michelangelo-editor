/**
 * EntityDialog — Add/edit dialog for all entity types.
 *
 * Renders form fields appropriate to the entity type (attribute, resource,
 * item, ability, trait, companion). Used by the Sidebar for
 * entity CRUD operations.
 */

import { useState } from 'react';
import { NumericInput } from './NumericInput';
import type {
  AttributeDefinition,
  ResourceDefinition,
  Item,
  ItemCategory,
  Ability,
  Trait,
  TraitCategory,
  CompanionDefinition,
  Story,
} from '@engine/types/index.js';
import type { EntityType, EntityTypeMap } from '@engine/engine/editor.js';

// =============================================================================
// ENTITY DIALOG
// =============================================================================

interface EntityDialogProps<K extends EntityType> {
  entityType: K;
  story: Story;
  existing?: EntityTypeMap[K];
  onSave: (entity: Omit<EntityTypeMap[K], 'id'> & { id?: string }) => void;
  onClose: () => void;
}

export function EntityDialog<K extends EntityType>({
  entityType,
  story,
  existing,
  onSave,
  onClose,
}: EntityDialogProps<K>) {
  const isEdit = !!existing;
  const label = ENTITY_LABELS[entityType];

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          {isEdit ? `Edit ${label}` : `New ${label}`}
        </div>
        <div className="dialog-body" style={{ overflowY: 'auto', flex: 1 }}>
          <EntityForm
            entityType={entityType}
            story={story}
            existing={existing}
            onSave={onSave}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}

const ENTITY_LABELS: Record<EntityType, string> = {
  attributes: 'Attribute',
  resources: 'Resource',
  items: 'Item',
  abilities: 'Ability',
  traits: 'Trait',
  companions: 'Companion',
};

// =============================================================================
// FORM ROUTING
// =============================================================================

function EntityForm<K extends EntityType>({
  entityType,
  story,
  existing,
  onSave,
  onClose,
}: {
  entityType: K;
  story: Story;
  existing?: EntityTypeMap[K];
  onSave: (entity: Omit<EntityTypeMap[K], 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  switch (entityType) {
    case 'attributes':
      return (
        <AttributeForm
          existing={existing as AttributeDefinition | undefined}
          onSave={onSave as any}
          onClose={onClose}
        />
      );
    case 'resources':
      return (
        <ResourceForm
          existing={existing as ResourceDefinition | undefined}
          onSave={onSave as any}
          onClose={onClose}
        />
      );
    case 'items':
      return (
        <ItemForm
          existing={existing as Item | undefined}
          onSave={onSave as any}
          onClose={onClose}
        />
      );
    case 'abilities':
      return (
        <AbilityForm
          existing={existing as Ability | undefined}
          story={story}
          onSave={onSave as any}
          onClose={onClose}
        />
      );
    case 'traits':
      return (
        <TraitForm
          existing={existing as Trait | undefined}
          onSave={onSave as any}
          onClose={onClose}
        />
      );
    case 'companions':
      return (
        <CompanionForm
          existing={existing as CompanionDefinition | undefined}
          onSave={onSave as any}
          onClose={onClose}
        />
      );
    default:
      return null;
  }
}

// =============================================================================
// ATTRIBUTE FORM
// =============================================================================

function AttributeForm({
  existing,
  onSave,
  onClose,
}: {
  existing?: AttributeDefinition;
  onSave: (e: Omit<AttributeDefinition, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [base, setBase] = useState(existing?.base ?? 10);
  const [min, setMin] = useState(existing?.min ?? 0);
  const [max, setMax] = useState(existing?.max ?? 20);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(existing ? { id: existing.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      base,
      min,
      max,
    });
    onClose();
  };

  return (
    <>
      <div className="field">
        <label className="field-label">Name *</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Strength" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Physical power" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Base</label>
          <NumericInput value={base} onChange={setBase} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Min</label>
          <NumericInput value={min} onChange={setMin} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Max</label>
          <NumericInput value={max} onChange={setMax} />
        </div>
      </div>
      <div className="dialog-actions" style={{ padding: '12px 0 0', border: 'none' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
          {existing ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

// =============================================================================
// RESOURCE FORM
// =============================================================================

function ResourceForm({
  existing,
  onSave,
  onClose,
}: {
  existing?: ResourceDefinition;
  onSave: (e: Omit<ResourceDefinition, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [defaultVal, setDefaultVal] = useState(existing?.default ?? 100);
  const [min, setMin] = useState(existing?.min ?? 0);
  const [max, setMax] = useState(existing?.max ?? 100);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(existing ? { id: existing.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      default: defaultVal,
      min,
      max,
    });
    onClose();
  };

  return (
    <>
      <div className="field">
        <label className="field-label">Name *</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Health" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Physical well-being" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Default</label>
          <NumericInput value={defaultVal} onChange={setDefaultVal} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Min</label>
          <NumericInput value={min} onChange={setMin} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Max</label>
          <NumericInput value={max} onChange={setMax} />
        </div>
      </div>
      <div className="dialog-actions" style={{ padding: '12px 0 0', border: 'none' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
          {existing ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

// =============================================================================
// ITEM FORM
// =============================================================================

const ITEM_CATEGORIES: ItemCategory[] = ['consumable', 'equipment', 'quest', 'currency', 'misc'];

function ItemForm({
  existing,
  onSave,
  onClose,
}: {
  existing?: Item;
  onSave: (e: Omit<Item, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<ItemCategory>(existing?.category ?? 'misc');
  const [stackable, setStackable] = useState(existing?.stackable ?? false);
  const [maxStack, setMaxStack] = useState(existing?.maxStack ?? 99);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(existing ? { id: existing.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      stackable,
      maxStack: stackable ? maxStack : undefined,
    });
    onClose();
  };

  return (
    <>
      <div className="field">
        <label className="field-label">Name *</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Health Potion" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Restores health" />
      </div>
      <div className="field">
        <label className="field-label">Category</label>
        <select className="field-select" value={category} onChange={(e) => setCategory(e.target.value as ItemCategory)}>
          {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={stackable} onChange={(e) => setStackable(e.target.checked)} />
          Stackable
        </label>
        {stackable && (
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label className="field-label">Max Stack</label>
            <NumericInput value={maxStack} onChange={setMaxStack} min={1} />
          </div>
        )}
      </div>
      <div className="dialog-actions" style={{ padding: '12px 0 0', border: 'none' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
          {existing ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

// =============================================================================
// TRAIT FORM
// =============================================================================

const TRAIT_CATEGORIES: TraitCategory[] = ['passive', 'status', 'background', 'achievement'];

function TraitForm({
  existing,
  onSave,
  onClose,
}: {
  existing?: Trait;
  onSave: (e: Omit<Trait, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [category, setCategory] = useState<TraitCategory>(existing?.category ?? 'passive');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(existing ? { id: existing.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      category,
    });
    onClose();
  };

  return (
    <>
      <div className="field">
        <label className="field-label">Name *</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Brave" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Fearless in the face of danger" />
      </div>
      <div className="field">
        <label className="field-label">Category</label>
        <select className="field-select" value={category} onChange={(e) => setCategory(e.target.value as TraitCategory)}>
          {TRAIT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="dialog-actions" style={{ padding: '12px 0 0', border: 'none' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
          {existing ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

// =============================================================================
// ABILITY FORM
// =============================================================================

function AbilityForm({
  existing,
  story,
  onSave,
  onClose,
}: {
  existing?: Ability;
  story: Story;
  onSave: (e: Omit<Ability, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [costResource, setCostResource] = useState(existing?.cost?.resource ?? '');
  const [costAmount, setCostAmount] = useState(existing?.cost?.amount ?? 0);

  const resources = Object.values(story.resources);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(existing ? { id: existing.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      cost: costResource && costAmount > 0 ? { resource: costResource, amount: costAmount } : undefined,
      effects: existing?.effects,
      condition: existing?.condition,
    });
    onClose();
  };

  return (
    <>
      <div className="field">
        <label className="field-label">Name *</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Fireball" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Hurls a ball of fire" />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="field" style={{ flex: 2 }}>
          <label className="field-label">Cost Resource</label>
          <select className="field-select" value={costResource} onChange={(e) => setCostResource(e.target.value)}>
            <option value="">None</option>
            {resources.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label">Amount</label>
          <NumericInput value={costAmount} onChange={setCostAmount} min={0} />
        </div>
      </div>
      <div className="dialog-actions" style={{ padding: '12px 0 0', border: 'none' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
          {existing ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

// =============================================================================
// COMPANION FORM
// =============================================================================

function CompanionForm({
  existing,
  onSave,
  onClose,
}: {
  existing?: CompanionDefinition;
  onSave: (e: Omit<CompanionDefinition, 'id'> & { id?: string }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [relationship, setRelationship] = useState(existing?.startingRelationship ?? 0);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      ...(existing ? { id: existing.id } : {}),
      name: name.trim(),
      description: description.trim() || undefined,
      baseAttributes: existing?.baseAttributes,
      baseResources: existing?.baseResources,
      startingAbilities: existing?.startingAbilities,
      startingTraits: existing?.startingTraits,
      startingRelationship: relationship,
    });
    onClose();
  };

  return (
    <>
      <div className="field">
        <label className="field-label">Name *</label>
        <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria" autoFocus />
      </div>
      <div className="field">
        <label className="field-label">Description</label>
        <textarea className="field-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A mysterious wanderer..." rows={3} />
      </div>
      <div className="field">
        <label className="field-label">Starting Relationship (-100 to 100)</label>
        <NumericInput value={relationship} onChange={setRelationship} min={-100} max={100} />
      </div>
      <div className="dialog-actions" style={{ padding: '12px 0 0', border: 'none' }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" onClick={handleSave} disabled={!name.trim()}>
          {existing ? 'Update' : 'Create'}
        </button>
      </div>
    </>
  );
}

