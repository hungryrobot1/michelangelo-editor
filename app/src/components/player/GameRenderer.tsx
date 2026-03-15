/**
 * GameRenderer — The main gameplay screen.
 *
 * Displays a scrollable narrative log of past and current node text,
 * with the current node's image as a sticky header and choices
 * pinned to the bottom. Character sheet sidebar on the left.
 */

import { useRef, useEffect } from 'react';
import type { Story, DialogueNode, Choice, GameState } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';
import type { NarrativeEntry } from '../../hooks/useGameEngine';

interface GameRendererProps {
  story: Story;
  currentNode: DialogueNode;
  narrativeLog: NarrativeEntry[];
  availableChoices: Choice[];
  allChoices?: Array<Choice & { available: boolean }>;
  gameState: GameState;
  debugMode?: boolean;
  onDebugToggle?: (enabled: boolean) => void;
  onMakeChoice: (choiceIndex: number) => void;
}

export function GameRenderer({
  story,
  currentNode,
  narrativeLog,
  availableChoices,
  allChoices,
  gameState,
  debugMode,
  onDebugToggle,
  onMakeChoice,
}: GameRendererProps) {
  const player = gameState.player;
  const attributes = Object.values(story.attributes);
  const resources = Object.values(story.resources);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new content appears
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [narrativeLog.length, currentNode.id]);

  return (
    <div className="game-layout">
      {/* ── Character sidebar ── */}
      <div className="game-sidebar">
        <div className="game-sidebar-section">
          <div className="game-sidebar-name">{player.name}</div>
        </div>

        {/* Resources */}
        {resources.length > 0 && (
          <div className="game-sidebar-section">
            <div className="game-sidebar-title">Resources</div>
            {resources.map((res) => {
              const current = player.resources[res.id] ?? 0;
              const max = res.max;
              return (
                <div key={res.id} className="game-resource-row">
                  <span className="game-resource-label">{res.name}</span>
                  <div className="game-resource-bar-bg">
                    <div
                      className="game-resource-bar-fill"
                      style={{ width: max ? `${(current / max) * 100}%` : '100%' }}
                    />
                    <span className="game-resource-bar-text">
                      {current}{max ? ` / ${max}` : ''}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Attributes */}
        {attributes.length > 0 && (
          <div className="game-sidebar-section">
            <div className="game-sidebar-title">Attributes</div>
            {attributes.map((attr) => (
              <div key={attr.id} className="game-stat-row">
                <span>{attr.name}</span>
                <span className="game-stat-value">{player.attributes[attr.id] ?? attr.base}</span>
              </div>
            ))}
          </div>
        )}

        {/* Inventory */}
        {player.items.length > 0 && (
          <div className="game-sidebar-section">
            <div className="game-sidebar-title">Inventory</div>
            {player.items.map((stack) => {
              const item = story.items?.[stack.itemId];
              return (
                <div key={stack.itemId} className="game-stat-row">
                  <span>{item?.name ?? stack.itemId}</span>
                  <span className="game-stat-value">x{stack.quantity}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Traits */}
        {player.traits.length > 0 && (
          <div className="game-sidebar-section">
            <div className="game-sidebar-title">Traits</div>
            <div className="game-tag-list">
              {player.traits.map((traitId) => {
                const trait = story.traits?.[traitId];
                return (
                  <span key={traitId} className="game-tag" title={trait?.description}>
                    {trait?.name ?? traitId}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Abilities */}
        {player.abilities.length > 0 && (
          <div className="game-sidebar-section">
            <div className="game-sidebar-title">Abilities</div>
            <div className="game-tag-list">
              {player.abilities.map((abilityId) => {
                const ability = story.abilities?.[abilityId];
                return (
                  <span key={abilityId} className="game-tag" title={ability?.description}>
                    {ability?.name ?? abilityId}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Companions */}
        {gameState.companions.filter((c) => c.inParty).length > 0 && (
          <div className="game-sidebar-section">
            <div className="game-sidebar-title">Companions</div>
            {gameState.companions.filter((c) => c.inParty).map((comp) => (
              <div key={comp.id} className="game-stat-row">
                <span>{comp.name}</span>
                <span className="game-stat-value" style={{
                  color: comp.relationship > 0 ? 'var(--color-success)' : comp.relationship < 0 ? 'var(--color-error)' : undefined
                }}>
                  {comp.relationship > 0 ? '+' : ''}{comp.relationship}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Main narrative area ── */}
      <div className="game-main">
        {/* Current node image — sticky at top */}
        {currentNode.image && (
          <div className="game-image-sticky">
            <img
              src={currentNode.image}
              alt=""
              className="game-image"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
        )}

        {/* Scrollable narrative log + current text */}
        <div className="game-narrative-scroll">
          {/* Past entries */}
          {narrativeLog.map((entry, i) => (
            <div key={i} className="game-log-entry">
              <div className="game-log-text">
                {entry.text.split('\n').map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
              {entry.chosenText && (
                <div className="game-log-choice">
                  &rsaquo; {entry.chosenText}
                </div>
              )}
              {entry.effects && entry.effects.length > 0 && (
                <div className="game-effects">
                  {entry.effects.map((desc, k) => (
                    <span key={k} className="game-effect-tag">{desc}</span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Current node text (live, not dimmed) */}
          <div className="game-current-text">
            <div className="game-text">
              {currentNode.text.split('\n').map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div ref={logEndRef} />
        </div>

        {/* Choices — pinned to bottom */}
        <div className="game-choices-footer">
          <div className="game-choices">
            {debugMode && allChoices ? (
              allChoices.map((choice, i) => (
                <button
                  key={i}
                  className={`game-choice-btn ${!choice.available ? 'game-choice-unavailable' : ''}`}
                  onClick={() => {
                    if (choice.available) {
                      const availIdx = availableChoices.findIndex((c) => c.text === choice.text && c.next === choice.next);
                      if (availIdx >= 0) onMakeChoice(availIdx);
                    }
                  }}
                  disabled={!choice.available}
                >
                  {choice.text}
                  {!choice.available && (
                    <span className="game-choice-locked"> (condition not met)</span>
                  )}
                </button>
              ))
            ) : (
              availableChoices.map((choice, i) => (
                <button
                  key={i}
                  className="game-choice-btn"
                  onClick={() => onMakeChoice(i)}
                >
                  {choice.text}
                </button>
              ))
            )}
          </div>

          {/* Debug panel */}
          {debugMode && onDebugToggle && (
            <div className="game-debug-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Debug
                </span>
                <button
                  className="btn"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={() => onDebugToggle(false)}
                >
                  Hide
                </button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                <div><strong>Node:</strong> {currentNode.id}</div>
                <div><strong>Visited:</strong> {gameState.visitedNodes.length} nodes</div>
                {gameState.player.items.length > 0 && (
                  <div><strong>Items:</strong> {gameState.player.items.map((s) => `${s.itemId}(${s.quantity})`).join(', ')}</div>
                )}
                {gameState.player.traits.length > 0 && (
                  <div><strong>Traits:</strong> {gameState.player.traits.join(', ')}</div>
                )}
                {gameState.player.abilities.length > 0 && (
                  <div><strong>Abilities:</strong> {gameState.player.abilities.join(', ')}</div>
                )}
                {Object.entries(gameState.player.attributes).map(([id, val]) => (
                  <div key={id}><strong>{id}:</strong> {val}</div>
                ))}
                {Object.entries(gameState.player.resources).map(([id, val]) => (
                  <div key={id}><strong>{id}:</strong> {val}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// GAME OVER SCREEN
// =============================================================================

interface GameOverProps {
  gameState: GameState;
  story: Story;
  onRestart: () => void;
  onExit: () => void;
}

export function GameOverScreen({ gameState, story, onRestart, onExit }: GameOverProps) {
  const lastNode = story.nodes[gameState.currentNode];

  return (
    <div className="player-screen">
      <div className="player-panel" style={{ maxWidth: 500, textAlign: 'center' }}>
        <h2 className="player-heading">The End</h2>

        {lastNode && isDialogueNode(lastNode) && (
          <div className="game-text" style={{ marginBottom: 24 }}>
            {lastNode.text.split('\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}

        <div style={{ fontSize: 13, color: 'var(--color-text-dim)', marginBottom: 24 }}>
          Nodes visited: {gameState.visitedNodes.length}
        </div>

        <div className="char-actions">
          <button className="btn" onClick={onExit}>Exit</button>
          <button className="btn primary" onClick={onRestart}>Play Again</button>
        </div>
      </div>
    </div>
  );
}
