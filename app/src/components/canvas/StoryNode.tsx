/**
 * StoryNode — Custom React Flow node component.
 *
 * Displays node name, text preview, effect chips, and choice summary.
 * Renders differently based on node type (dialogue vs character creation).
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { StoryNode as StoryNodeType } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';
import { EffectChipDisplay, formatCondition } from '../shared/EffectChip';

export interface StoryNodeData {
  [key: string]: unknown;
  storyNode: StoryNodeType;
  isStartNode: boolean;
  isTerminal: boolean;
  isSelected: boolean;
}

function StoryNodeComponent({ data }: NodeProps & { data: StoryNodeData }) {
  const { storyNode, isStartNode, isTerminal, isSelected } = data;

  const isCharCreation = storyNode.type === 'characterCreation';

  const classNames = [
    'story-node',
    isSelected && 'selected',
    isStartNode && 'start-node',
    isTerminal && !isStartNode && 'terminal-node',
    isCharCreation && 'char-creation-node',
  ].filter(Boolean).join(' ');

  return (
    <>
      <Handle type="target" position={Position.Left} />
      <div className={classNames}>
        {/* Header */}
        <div className="story-node-header">
          <div className="story-node-name">
            {storyNode.name || storyNode.id}
          </div>
          {isStartNode && (
            <span className="story-node-badge start">START</span>
          )}
          {isCharCreation && (
            <span className="story-node-badge" style={{ background: 'var(--color-primary)' }}>CHAR</span>
          )}
          {isTerminal && !isStartNode && (
            <span className="story-node-badge end">END</span>
          )}
        </div>

        {/* Type-specific body */}
        {isDialogueNode(storyNode) ? (
          <>
            {/* Text preview */}
            <div className="story-node-body">
              <div className="story-node-text">
                {storyNode.text || '(empty)'}
              </div>
            </div>

            {/* onEnter effects */}
            {storyNode.onEnter && storyNode.onEnter.length > 0 && (
              <div className="story-node-effects">
                {storyNode.onEnter.slice(0, 3).map((effect, i) => (
                  <EffectChipDisplay key={i} effect={effect} />
                ))}
                {storyNode.onEnter.length > 3 && (
                  <span className="effect-chip">+{storyNode.onEnter.length - 3} more</span>
                )}
              </div>
            )}

            {/* Choices */}
            {storyNode.choices.length > 0 && (
              <div className="story-node-choices">
                {storyNode.choices.map((choice, i) => (
                  <div key={i} className="story-node-choice">
                    <span className="story-node-choice-arrow">&rarr;</span>
                    <span>{truncate(choice.text, 30)}</span>
                    {choice.condition && (
                      <span className="story-node-choice-condition">
                        ({formatCondition(choice.condition)})
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Character creation node body */}
            <div className="story-node-body">
              <div className="story-node-text" style={{ fontStyle: 'italic', color: 'var(--color-text-dim)' }}>
                Character Creation
              </div>
            </div>

            {/* onEnter effects */}
            {storyNode.onEnter && storyNode.onEnter.length > 0 && (
              <div className="story-node-effects">
                {storyNode.onEnter.slice(0, 3).map((effect, i) => (
                  <EffectChipDisplay key={i} effect={effect} />
                ))}
                {storyNode.onEnter.length > 3 && (
                  <span className="effect-chip">+{storyNode.onEnter.length - 3} more</span>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </>
  );
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '\u2026';
}

export const StoryNodeComponent_Memo = memo(StoryNodeComponent);
