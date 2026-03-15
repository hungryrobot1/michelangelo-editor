/**
 * Sidebar — Tabbed panel system with Entities, Story, and Settings.
 *
 * Each entity type has an accordion with its items listed, clickable
 * for editing, and an "Add" button. Entities can also be deleted.
 */

import { useState } from 'react';
import type { Story, CharacterCreationSchema } from '@engine/types/index.js';
import type { EntityType, EntityTypeMap } from '@engine/engine/editor.js';
import { NumericInput } from '../shared/NumericInput';
import { EntityDialog } from '../shared/EntityDialog';
import { StoryPanel } from './StoryPanel';
import { SettingsPanel } from './SettingsPanel';

type SidebarTab = 'entities' | 'story' | 'settings';

interface SidebarProps {
  story: Story;
  isOpen: boolean;
  selectedNodeId?: string | null;
  onAddEntity: <K extends EntityType>(entityType: K, entity: Omit<EntityTypeMap[K], 'id'> & { id?: string }) => void;
  onUpdateEntity: <K extends EntityType>(entityType: K, entityId: string, updates: Partial<Omit<EntityTypeMap[K], 'id'>>) => void;
  onRemoveEntity: <K extends EntityType>(entityType: K, entityId: string, cascade?: boolean) => void;
  onSelectNode?: (nodeId: string) => void;
  onUpdateManifest?: (updates: Partial<Omit<Story['manifest'], 'id'>>) => void;
  onUpdateCharacterCreation?: (updates: Partial<CharacterCreationSchema> | undefined) => void;
}

interface AccordionSectionProps {
  title: string;
  count: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function AccordionSection({ title, count, children, defaultOpen = false }: AccordionSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="accordion-section">
      <div className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
        <span className={`accordion-arrow ${isOpen ? 'open' : ''}`}>&rsaquo;</span>
        <span className="accordion-title">{title}</span>
        <span className="accordion-count">{count}</span>
      </div>
      <div className={`accordion-body ${isOpen ? '' : 'collapsed'}`}>
        {children}
      </div>
    </div>
  );
}

function EntityList({
  items,
  label,
  onEdit,
  onDelete,
  onAdd,
}: {
  items: { id: string; name: string }[];
  label: string;
  onEdit: (item: { id: string; name: string }) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <>
      {items.map((item) => (
        <div key={item.id} className="entity-item" onClick={() => onEdit(item)}>
          <span className="entity-item-name">{item.name}</span>
          <span className="entity-item-id">{item.id}</span>
          <button
            className="entity-delete-btn"
            title={`Delete ${label}`}
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          >
            &times;
          </button>
        </div>
      ))}
      <button className="entity-add-btn" onClick={onAdd}>
        + Add {label}
      </button>
    </>
  );
}

type DialogState =
  | null
  | { mode: 'add'; entityType: EntityType }
  | { mode: 'edit'; entityType: EntityType; entityId: string };

export function Sidebar({
  story,
  isOpen,
  selectedNodeId,
  onAddEntity,
  onUpdateEntity,
  onRemoveEntity,
  onSelectNode,
  onUpdateManifest,
  onUpdateCharacterCreation,
}: SidebarProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [activeTab, setActiveTab] = useState<SidebarTab>('entities');

  if (!isOpen) return null;

  const attributes = Object.values(story.attributes);
  const resources = Object.values(story.resources);
  const items = Object.values(story.items ?? {});
  const abilities = Object.values(story.abilities ?? {});
  const traits = Object.values(story.traits ?? {});
  const companions = Object.values(story.companions ?? {});
  const handleAdd = (entityType: EntityType) => setDialog({ mode: 'add', entityType });
  const handleEdit = (entityType: EntityType, entityId: string) => setDialog({ mode: 'edit', entityType, entityId });
  const handleDelete = (entityType: EntityType, entityId: string) => {
    onRemoveEntity(entityType, entityId, true);
  };

  // Get the existing entity for edit mode
  const getExisting = (): any => {
    if (!dialog || dialog.mode !== 'edit') return undefined;
    switch (dialog.entityType) {
      case 'attributes': return story.attributes[dialog.entityId];
      case 'resources': return story.resources[dialog.entityId];
      case 'items': return story.items?.[dialog.entityId];
      case 'abilities': return story.abilities?.[dialog.entityId];
      case 'traits': return story.traits?.[dialog.entityId];
      case 'companions': return story.companions?.[dialog.entityId];
      default: return undefined;
    }
  };

  const handleDialogSave = (entity: any) => {
    if (!dialog) return;
    if (dialog.mode === 'add') {
      onAddEntity(dialog.entityType, entity);
    } else {
      const { id, ...updates } = entity;
      onUpdateEntity(dialog.entityType, dialog.entityId, updates);
    }
  };

  return (
    <div className="sidebar">
      {/* Tab bar */}
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === 'entities' ? 'active' : ''}`}
          onClick={() => setActiveTab('entities')}
        >
          Entities
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'story' ? 'active' : ''}`}
          onClick={() => setActiveTab('story')}
        >
          Story
        </button>
        <button
          className={`sidebar-tab ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'entities' && (
        <div className="sidebar-content">
          <AccordionSection title="Attributes" count={attributes.length} defaultOpen>
            <EntityList
              items={attributes}
              label="Attribute"
              onEdit={(item) => handleEdit('attributes', item.id)}
              onDelete={(id) => handleDelete('attributes', id)}
              onAdd={() => handleAdd('attributes')}
            />
            {onUpdateCharacterCreation && (
              <AttributeSettings
                charCreation={story.characterCreation}
                onUpdate={onUpdateCharacterCreation}
              />
            )}
          </AccordionSection>

          <AccordionSection title="Resources" count={resources.length} defaultOpen>
            <EntityList
              items={resources}
              label="Resource"
              onEdit={(item) => handleEdit('resources', item.id)}
              onDelete={(id) => handleDelete('resources', id)}
              onAdd={() => handleAdd('resources')}
            />
          </AccordionSection>

          <AccordionSection title="Items" count={items.length}>
            <EntityList
              items={items}
              label="Item"
              onEdit={(item) => handleEdit('items', item.id)}
              onDelete={(id) => handleDelete('items', id)}
              onAdd={() => handleAdd('items')}
            />
          </AccordionSection>

          <AccordionSection title="Abilities" count={abilities.length}>
            <EntityList
              items={abilities}
              label="Ability"
              onEdit={(item) => handleEdit('abilities', item.id)}
              onDelete={(id) => handleDelete('abilities', id)}
              onAdd={() => handleAdd('abilities')}
            />
          </AccordionSection>

          <AccordionSection title="Traits" count={traits.length}>
            <EntityList
              items={traits}
              label="Trait"
              onEdit={(item) => handleEdit('traits', item.id)}
              onDelete={(id) => handleDelete('traits', id)}
              onAdd={() => handleAdd('traits')}
            />
          </AccordionSection>

          <AccordionSection title="Companions" count={companions.length}>
            <EntityList
              items={companions}
              label="Companion"
              onEdit={(item) => handleEdit('companions', item.id)}
              onDelete={(id) => handleDelete('companions', id)}
              onAdd={() => handleAdd('companions')}
            />
          </AccordionSection>

        </div>
      )}

      {activeTab === 'story' && (
        <StoryPanel
          story={story}
          selectedNodeId={selectedNodeId ?? null}
          onSelectNode={onSelectNode ?? (() => {})}
        />
      )}

      {activeTab === 'settings' && onUpdateManifest && (
        <SettingsPanel
          story={story}
          onUpdateManifest={onUpdateManifest}
        />
      )}

      {dialog && (
        <EntityDialog
          entityType={dialog.entityType}
          story={story}
          existing={dialog.mode === 'edit' ? getExisting() : undefined}
          onSave={handleDialogSave}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// ATTRIBUTE SETTINGS (point budget, cost curve)
// =============================================================================

function AttributeSettings({
  charCreation,
  onUpdate,
}: {
  charCreation?: CharacterCreationSchema;
  onUpdate: (updates: Partial<CharacterCreationSchema> | undefined) => void;
}) {
  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--color-border)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Point Buy
      </div>

      <div className="field">
        <label className="field-label">Method</label>
        <select
          className="field-select"
          value={charCreation?.method ?? 'point-buy'}
          onChange={(e) => onUpdate({ method: e.target.value as 'point-buy' | 'freeform' })}
        >
          <option value="point-buy">Point Buy</option>
          <option value="freeform">Freeform</option>
        </select>
      </div>

      {(charCreation?.method ?? 'point-buy') === 'point-buy' && (
        <>
          <div className="field">
            <label className="field-label">Point Budget</label>
            <NumericInput
              value={charCreation?.pointBudget ?? 27}
              onChange={(v) => onUpdate({ pointBudget: v })}
              min={0}
            />
          </div>

          <CostCurveEditor
            costCurve={charCreation?.costCurve ?? [{ threshold: 13, cost: 2 }]}
            onChange={(costCurve) => onUpdate({ costCurve })}
          />
        </>
      )}
    </div>
  );
}

// =============================================================================
// COST CURVE EDITOR
// =============================================================================

function CostCurveEditor({
  costCurve,
  onChange,
}: {
  costCurve: { threshold: number; cost: number }[];
  onChange: (curve: { threshold: number; cost: number }[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="field">
      <label className="field-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Cost Curve</span>
        <button
          className="btn"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? 'Hide' : 'Edit'}
        </button>
      </label>

      {!isOpen && (
        <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 2 }}>
          {costCurve.length === 0
            ? 'Flat (1pt per increase)'
            : costCurve.map((e) => `>${e.threshold}: ${e.cost}pt`).join(', ')}
        </div>
      )}

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {costCurve.map((entry, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)', whiteSpace: 'nowrap' }}>Above</span>
              <NumericInput
                style={{ width: 60 }}
                value={entry.threshold}
                onChange={(v) => {
                  const next = [...costCurve];
                  next[i] = { threshold: v, cost: entry.cost };
                  onChange(next);
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>:</span>
              <NumericInput
                style={{ width: 50 }}
                value={entry.cost}
                onChange={(v) => {
                  const next = [...costCurve];
                  next[i] = { threshold: entry.threshold, cost: v };
                  onChange(next);
                }}
                min={1}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>pt</span>
              <button
                className="entity-delete-btn"
                style={{ opacity: 1 }}
                onClick={() => onChange(costCurve.filter((_, j) => j !== i))}
                title="Remove breakpoint"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            className="entity-add-btn"
            style={{ marginTop: 2 }}
            onClick={() => {
              const last = costCurve[costCurve.length - 1];
              const lastThreshold = last?.threshold ?? 10;
              const lastCost = last?.cost ?? 1;
              onChange([...costCurve, { threshold: lastThreshold + 2, cost: lastCost + 1 }]);
            }}
          >
            + Add Breakpoint
          </button>
        </div>
      )}
    </div>
  );
}
