/**
 * Inspector — Node detail editing panel.
 *
 * Shows when a node is selected. Provides editable fields for
 * node name, text, image, onEnter effects, and choices (with
 * conditions, effects, and reordering).
 */

import { useState } from 'react';
import type { Story, StoryNode, Choice, Effect, Condition, RegionComment } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';
import { EffectChipDisplay, formatCondition } from '../shared/EffectChip';
import { EffectBuilder } from '../shared/EffectBuilder';
import { ConditionBuilder } from '../shared/ConditionBuilder';
import { REGION_COLORS } from '../canvas/CanvasContextMenu';

interface InspectorProps {
  story: Story;
  selectedNodeId: string | null;
  onUpdateNode: (nodeId: string, updates: Record<string, unknown>) => void;
  onAddChoice: (nodeId: string, choice: Choice) => void;
  onUpdateChoice: (nodeId: string, choiceIndex: number, updates: Partial<Choice>) => void;
  onRemoveChoice: (nodeId: string, choiceIndex: number) => void;
  onReorderChoices: (nodeId: string, newOrder: number[]) => void;
  onDeleteNode: (nodeId: string) => void;
  onSetStartNode?: (nodeId: string) => void;
  onPlayFromNode?: (nodeId: string) => void;
  onUpdateRegionComment?: (id: string, updates: Partial<Omit<RegionComment, 'id'>>) => void;
  onDeleteRegionComment?: (id: string) => void;
}

type BuilderState =
  | null
  | { type: 'nodeEffect'; mode: 'add' }
  | { type: 'nodeEffect'; mode: 'edit'; index: number }
  | { type: 'choiceEffect'; choiceIndex: number; mode: 'add' }
  | { type: 'choiceEffect'; choiceIndex: number; mode: 'edit'; effectIndex: number }
  | { type: 'choiceCondition'; choiceIndex: number };

export function Inspector({
  story,
  selectedNodeId,
  onUpdateNode,
  onAddChoice,
  onUpdateChoice,
  onRemoveChoice,
  onReorderChoices,
  onDeleteNode,
  onSetStartNode,
  onPlayFromNode,
  onUpdateRegionComment,
  onDeleteRegionComment,
}: InspectorProps) {
  const [builder, setBuilder] = useState<BuilderState>(null);

  if (!selectedNodeId) {
    return (
      <div className="inspector">
        <div className="inspector-empty">
          Select a node to inspect
        </div>
      </div>
    );
  }

  // Check if selected item is a region comment
  const regionComment = (story.regionComments ?? []).find((c) => c.id === selectedNodeId);
  if (regionComment) {
    return (
      <RegionCommentInspector
        comment={regionComment}
        onUpdate={onUpdateRegionComment}
        onDelete={onDeleteRegionComment}
      />
    );
  }

  const node = story.nodes[selectedNodeId];
  if (!node) {
    return (
      <div className="inspector">
        <div className="inspector-empty">
          Node not found
        </div>
      </div>
    );
  }

  const isStartNode = selectedNodeId === story.manifest.startNode;
  const nodeIds = Object.keys(story.nodes);
  const isDialogue = isDialogueNode(node);

  // ── onEnter effect handlers ──

  const handleAddNodeEffect = (effect: Effect) => {
    const existing = node.onEnter ?? [];
    onUpdateNode(selectedNodeId, { onEnter: [...existing, effect] });
  };

  const handleEditNodeEffect = (index: number, effect: Effect) => {
    const existing = [...(node.onEnter ?? [])];
    existing[index] = effect;
    onUpdateNode(selectedNodeId, { onEnter: existing });
  };

  const handleRemoveNodeEffect = (index: number) => {
    const existing = [...(node.onEnter ?? [])];
    existing.splice(index, 1);
    onUpdateNode(selectedNodeId, { onEnter: existing.length > 0 ? existing : undefined });
  };

  // ── Choice effect/condition handlers (dialogue only) ──

  const handleAddChoiceEffect = (choiceIndex: number, effect: Effect) => {
    if (!isDialogue) return;
    const choice = node.choices[choiceIndex];
    if (!choice) return;
    const effects = [...(choice.effects ?? []), effect];
    onUpdateChoice(selectedNodeId, choiceIndex, { effects });
  };

  const handleEditChoiceEffect = (choiceIndex: number, effectIndex: number, effect: Effect) => {
    if (!isDialogue) return;
    const choice = node.choices[choiceIndex];
    if (!choice) return;
    const effects = [...(choice.effects ?? [])];
    effects[effectIndex] = effect;
    onUpdateChoice(selectedNodeId, choiceIndex, { effects });
  };

  const handleRemoveChoiceEffect = (choiceIndex: number, effectIndex: number) => {
    if (!isDialogue) return;
    const choice = node.choices[choiceIndex];
    if (!choice) return;
    const effects = [...(choice.effects ?? [])];
    effects.splice(effectIndex, 1);
    onUpdateChoice(selectedNodeId, choiceIndex, { effects: effects.length > 0 ? effects : undefined });
  };

  const handleSetChoiceCondition = (choiceIndex: number, condition: Condition) => {
    onUpdateChoice(selectedNodeId, choiceIndex, { condition });
  };

  const handleRemoveChoiceCondition = (choiceIndex: number) => {
    onUpdateChoice(selectedNodeId, choiceIndex, { condition: undefined });
  };

  // ── Choice reorder ──

  const handleMoveChoice = (index: number, direction: -1 | 1) => {
    if (!isDialogue) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= node.choices.length) return;
    const order = node.choices.map((_: unknown, i: number) => i);
    [order[index], order[newIndex]] = [order[newIndex]!, order[index]!];
    onReorderChoices(selectedNodeId, order);
  };

  return (
    <div className="inspector">
      <div className="inspector-header">
        <span className="inspector-header-title">
          {node.name || node.id}
        </span>
        {isStartNode && (
          <span className="story-node-badge start">START</span>
        )}
        {node.type === 'characterCreation' && (
          <span className="story-node-badge" style={{ background: 'var(--color-primary)' }}>CHAR</span>
        )}
      </div>

      <div className="inspector-content">
        {/* Node Name (common) */}
        <div className="inspector-section">
          <div className="inspector-section-title">Name</div>
          <div className="field">
            <input
              className="field-input"
              value={node.name || ''}
              onChange={(e) => onUpdateNode(selectedNodeId, { name: e.target.value || undefined })}
              placeholder="Node name..."
            />
          </div>
        </div>

        {/* Node Type indicator */}
        <div className="inspector-section">
          <div className="inspector-section-title">Type</div>
          <div style={{ fontSize: 13, color: 'var(--color-text-dim)' }}>
            {node.type === 'characterCreation' ? 'Character Creation' : 'Dialogue'}
          </div>
        </div>

        {/* Set as Start Node */}
        {!isStartNode && onSetStartNode && (
          <div className="inspector-section">
            <button
              className="btn"
              style={{ width: '100%' }}
              onClick={() => onSetStartNode(selectedNodeId)}
            >
              Set as Start Node
            </button>
          </div>
        )}

        {/* Play from Here */}
        {onPlayFromNode && isDialogue && (
          <div className="inspector-section">
            <button
              className="btn primary"
              style={{ width: '100%' }}
              onClick={() => onPlayFromNode(selectedNodeId)}
            >
              Play from Here
            </button>
          </div>
        )}

        {/* ── Dialogue-specific fields ── */}
        {isDialogue && (
          <>
            {/* Node Text */}
            <div className="inspector-section">
              <div className="inspector-section-title">Text</div>
              <div className="field">
                <textarea
                  className="field-textarea"
                  value={node.text}
                  onChange={(e) => onUpdateNode(selectedNodeId, { text: e.target.value })}
                  placeholder="Narrative text..."
                  rows={5}
                />
              </div>
            </div>

            {/* Image */}
            <div className="inspector-section">
              <div className="inspector-section-title">Image</div>
              <div className="field">
                <input
                  className="field-input"
                  value={node.image || ''}
                  onChange={(e) => onUpdateNode(selectedNodeId, { image: e.target.value || undefined })}
                  placeholder="image-filename.jpg"
                />
              </div>
            </div>
          </>
        )}

        {/* ── Character creation node fields ── */}
        {node.type === 'characterCreation' && (
          <div className="inspector-section">
            <div className="inspector-section-title">Next Node</div>
            <div className="field">
              <select
                className="field-select"
                value={node.next}
                onChange={(e) => onUpdateNode(selectedNodeId, { next: e.target.value } as any)}
              >
                {nodeIds.map((id) => (
                  <option key={id} value={id}>{story.nodes[id]?.name || id}</option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 4 }}>
              The node to advance to after character creation completes.
            </div>
          </div>
        )}

        {/* onEnter Effects (common) */}
        <div className="inspector-section">
          <div className="inspector-section-title">
            On Enter Effects ({node.onEnter?.length ?? 0})
          </div>
          {node.onEnter && node.onEnter.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
              {node.onEnter.map((effect, i) => (
                <span key={i} className="effect-chip effect-chip-interactive" onClick={() => setBuilder({ type: 'nodeEffect', mode: 'edit', index: i })}>
                  <EffectChipDisplay effect={effect} />
                  <button
                    className="chip-remove-btn"
                    onClick={(e) => { e.stopPropagation(); handleRemoveNodeEffect(i); }}
                    title="Remove effect"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
          <button
            className="entity-add-btn"
            style={{ marginTop: 4 }}
            onClick={() => setBuilder({ type: 'nodeEffect', mode: 'add' })}
          >
            + Add Effect
          </button>
        </div>

        {/* Choices (dialogue only) */}
        {isDialogue && (
          <div className="inspector-section">
            <div className="inspector-section-title">
              Choices ({node.choices.length})
            </div>
            {node.choices.map((choice, i) => (
              <ChoiceEditor
                key={i}
                choice={choice}
                index={i}
                totalChoices={node.choices.length}
                nodeIds={nodeIds}
                story={story}
                onUpdate={(updates) => onUpdateChoice(selectedNodeId, i, updates)}
                onRemove={() => onRemoveChoice(selectedNodeId, i)}
                onMoveUp={() => handleMoveChoice(i, -1)}
                onMoveDown={() => handleMoveChoice(i, 1)}
                onAddEffect={() => setBuilder({ type: 'choiceEffect', choiceIndex: i, mode: 'add' })}
                onEditEffect={(ei) => setBuilder({ type: 'choiceEffect', choiceIndex: i, mode: 'edit', effectIndex: ei })}
                onRemoveEffect={(ei) => handleRemoveChoiceEffect(i, ei)}
                onEditCondition={() => setBuilder({ type: 'choiceCondition', choiceIndex: i })}
                onRemoveCondition={() => handleRemoveChoiceCondition(i)}
              />
            ))}
            <button
              className="entity-add-btn"
              onClick={() => onAddChoice(selectedNodeId, { text: 'New choice...', next: selectedNodeId })}
            >
              + Add Choice
            </button>
          </div>
        )}

        {/* Danger zone */}
        {!isStartNode && (
          <div className="inspector-section" style={{ marginTop: 24 }}>
            <button
              className="btn"
              style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
              onClick={() => onDeleteNode(selectedNodeId)}
            >
              Delete Node
            </button>
          </div>
        )}
      </div>

      {/* ── Builder modals ── */}

      {builder?.type === 'nodeEffect' && (
        <EffectBuilder
          story={story}
          existing={builder.mode === 'edit' ? node.onEnter?.[builder.index] : undefined}
          onSave={(effect) => {
            if (builder.mode === 'edit') {
              handleEditNodeEffect(builder.index, effect);
            } else {
              handleAddNodeEffect(effect);
            }
          }}
          onClose={() => setBuilder(null)}
        />
      )}

      {isDialogue && builder?.type === 'choiceEffect' && (
        <EffectBuilder
          story={story}
          existing={
            builder.mode === 'edit'
              ? node.choices[builder.choiceIndex]?.effects?.[builder.effectIndex]
              : undefined
          }
          onSave={(effect) => {
            if (builder.mode === 'edit') {
              handleEditChoiceEffect(builder.choiceIndex, builder.effectIndex, effect);
            } else {
              handleAddChoiceEffect(builder.choiceIndex, effect);
            }
          }}
          onClose={() => setBuilder(null)}
        />
      )}

      {isDialogue && builder?.type === 'choiceCondition' && (
        <ConditionBuilder
          story={story}
          existing={node.choices[builder.choiceIndex]?.condition}
          onSave={(condition) => handleSetChoiceCondition(builder.choiceIndex, condition)}
          onClose={() => setBuilder(null)}
        />
      )}
    </div>
  );
}

// =============================================================================
// CHOICE EDITOR
// =============================================================================

function ChoiceEditor({
  choice,
  index,
  totalChoices,
  nodeIds,
  story,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddEffect,
  onEditEffect,
  onRemoveEffect,
  onEditCondition,
  onRemoveCondition,
}: {
  choice: Choice;
  index: number;
  totalChoices: number;
  nodeIds: string[];
  story: Story;
  onUpdate: (updates: Partial<Choice>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onAddEffect: () => void;
  onEditEffect: (effectIndex: number) => void;
  onRemoveEffect: (effectIndex: number) => void;
  onEditCondition: () => void;
  onRemoveCondition: () => void;
}) {
  return (
    <div style={{
      padding: '8px',
      marginBottom: '8px',
      background: 'var(--color-bg)',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border)',
    }}>
      {/* Choice text */}
      <div className="field">
        <label className="field-label">Text</label>
        <input
          className="field-input"
          value={choice.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
        />
      </div>

      {/* Target node */}
      <div className="field">
        <label className="field-label">Target Node</label>
        <select
          className="field-select"
          value={choice.next}
          onChange={(e) => onUpdate({ next: e.target.value })}
        >
          {nodeIds.map((id) => (
            <option key={id} value={id}>{story.nodes[id]?.name || id}</option>
          ))}
        </select>
      </div>

      {/* Condition */}
      <div style={{ marginBottom: 8 }}>
        <span className="field-label">Condition</span>
        {choice.condition ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <span
              className="effect-chip condition-chip"
              style={{ cursor: 'pointer' }}
              onClick={onEditCondition}
            >
              {formatCondition(choice.condition)}
            </span>
            <button
              className="chip-remove-btn"
              onClick={onRemoveCondition}
              title="Remove condition"
            >
              &times;
            </button>
          </div>
        ) : (
          <button
            className="entity-add-btn"
            style={{ marginTop: 4 }}
            onClick={onEditCondition}
          >
            + Add Condition
          </button>
        )}
      </div>

      {/* Effects */}
      <div style={{ marginBottom: 8 }}>
        <span className="field-label">Effects ({choice.effects?.length ?? 0})</span>
        {choice.effects && choice.effects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {choice.effects.map((effect, i) => (
              <span key={i} className="effect-chip effect-chip-interactive" onClick={() => onEditEffect(i)}>
                <EffectChipDisplay effect={effect} />
                <button
                  className="chip-remove-btn"
                  onClick={(e) => { e.stopPropagation(); onRemoveEffect(i); }}
                  title="Remove effect"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          className="entity-add-btn"
          style={{ marginTop: 4 }}
          onClick={onAddEffect}
        >
          + Add Effect
        </button>
      </div>

      {/* Requires ability */}
      <div className="field">
        <label className="field-label">Requires Ability</label>
        <select
          className="field-select"
          value={choice.requiresAbility ?? ''}
          onChange={(e) => onUpdate({ requiresAbility: e.target.value || undefined })}
        >
          <option value="">None</option>
          {Object.values(story.abilities ?? {}).map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={onMoveUp} disabled={index === 0} title="Move up">
          &uarr;
        </button>
        <button className="btn" style={{ fontSize: 11, padding: '3px 8px' }} onClick={onMoveDown} disabled={index === totalChoices - 1} title="Move down">
          &darr;
        </button>
        <div style={{ flex: 1 }} />
        <button
          className="btn"
          style={{ fontSize: 11, padding: '3px 8px', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
          onClick={onRemove}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// REGION COMMENT INSPECTOR
// =============================================================================

function RegionCommentInspector({
  comment,
  onUpdate,
  onDelete,
}: {
  comment: RegionComment;
  onUpdate?: (id: string, updates: Partial<Omit<RegionComment, 'id'>>) => void;
  onDelete?: (id: string) => void;
}) {
  const accentColor = comment.color || REGION_COLORS[0].value;

  return (
    <div className="inspector">
      <div className="inspector-header">
        <span className="inspector-header-title">
          {comment.label}
        </span>
        <span
          className="story-node-badge"
          style={{ background: accentColor, color: '#fff' }}
        >
          REGION
        </span>
      </div>

      <div className="inspector-content">
        {/* Label */}
        <div className="inspector-section">
          <div className="inspector-section-title">Label</div>
          <div className="field">
            <input
              className="field-input"
              value={comment.label}
              onChange={(e) => onUpdate?.(comment.id, { label: e.target.value })}
            />
          </div>
        </div>

        {/* Color */}
        <div className="inspector-section">
          <div className="inspector-section-title">Color</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {REGION_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.name}
                onClick={() => onUpdate?.(comment.id, { color: c.value })}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: c.value,
                  border: c.value === accentColor
                    ? '2px solid #fff'
                    : '2px solid transparent',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="inspector-section">
          <div className="inspector-section-title">Notes</div>
          <div className="field">
            <textarea
              className="field-input"
              rows={6}
              placeholder="Jot down notes about this region..."
              value={comment.comment ?? ''}
              onChange={(e) => onUpdate?.(comment.id, { comment: e.target.value || undefined })}
              style={{ resize: 'vertical', minHeight: 80 }}
            />
          </div>
        </div>

        {/* Delete */}
        <div className="inspector-section" style={{ marginTop: 24 }}>
          <button
            className="btn"
            style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
            onClick={() => onDelete?.(comment.id)}
          >
            Delete Region
          </button>
        </div>
      </div>
    </div>
  );
}
