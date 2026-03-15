/**
 * CharacterCreation — Point-buy character creation screen.
 *
 * Lets the player name their character and allocate attribute points
 * using the game-defined schema.
 */

import type { PlayerCharacter } from '@engine/types/index.js';
import type { CharacterCreationConfig, CharacterValidation } from '@engine/engine/character.js';
import { getIncreaseCost } from '@engine/engine/character.js';

interface CharacterCreationProps {
  config: CharacterCreationConfig;
  character: PlayerCharacter;
  pointsRemaining: number;
  validation: CharacterValidation;
  onSetName: (name: string) => void;
  onIncrease: (attributeId: string) => void;
  onDecrease: (attributeId: string) => void;
  onStart: () => void;
  onSkip: () => void;
}

export function CharacterCreation({
  config,
  character,
  pointsRemaining,
  validation,
  onSetName,
  onIncrease,
  onDecrease,
  onStart,
  onSkip,
}: CharacterCreationProps) {
  return (
    <div className="player-screen">
      <div className="player-panel" style={{ maxWidth: 500 }}>
        <h2 className="player-heading">Create Your Character</h2>

        {/* Name */}
        <div className="field" style={{ marginBottom: 20 }}>
          <label className="field-label">Character Name</label>
          <input
            className="field-input"
            value={character.name}
            onChange={(e) => onSetName(e.target.value)}
            placeholder="Enter a name..."
            autoFocus
          />
        </div>

        {/* Points remaining */}
        <div className="char-points-bar">
          <span>Points Remaining</span>
          <span className={`char-points-value ${pointsRemaining === 0 ? 'spent' : pointsRemaining < 0 ? 'over' : ''}`}>
            {pointsRemaining} / {config.pointBudget}
          </span>
        </div>

        {/* Attributes */}
        <div className="char-attributes">
          {config.attributes.map((attrDef) => {
            const value = character.attributes[attrDef.id] ?? attrDef.base;
            const cost = getIncreaseCost(value, attrDef, config);
            const atMin = value <= (attrDef.min ?? 0);
            const atMax = attrDef.max !== undefined && value >= attrDef.max;
            const cantAfford = cost > pointsRemaining;

            return (
              <div key={attrDef.id} className="char-attr-row">
                <div className="char-attr-info">
                  <span className="char-attr-name">{attrDef.name}</span>
                  {attrDef.description && (
                    <span className="char-attr-desc">{attrDef.description}</span>
                  )}
                </div>
                <div className="char-attr-controls">
                  <span className="char-attr-cost">{!atMax ? `${cost}pt` : ''}</span>
                  <button
                    className="char-attr-btn"
                    onClick={() => onDecrease(attrDef.id)}
                    disabled={atMin}
                  >
                    -
                  </button>
                  <span className="char-attr-value">{value}</span>
                  <button
                    className="char-attr-btn"
                    onClick={() => onIncrease(attrDef.id)}
                    disabled={atMax || cantAfford}
                    title={cantAfford ? `Costs ${cost} points` : undefined}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Validation messages */}
        {validation.errors.length > 0 && (
          <div className="char-messages">
            {validation.errors.map((err, i) => (
              <div key={i} className="char-message error">{err}</div>
            ))}
          </div>
        )}
        {validation.warnings.length > 0 && (
          <div className="char-messages">
            {validation.warnings.map((warn, i) => (
              <div key={i} className="char-message warning">{warn}</div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="char-actions">
          <button className="btn" onClick={onSkip}>
            Skip (Use Defaults)
          </button>
          <button
            className="btn primary"
            onClick={onStart}
            disabled={!validation.valid}
          >
            Begin Adventure
          </button>
        </div>
      </div>
    </div>
  );
}
