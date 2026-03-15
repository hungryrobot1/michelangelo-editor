/**
 * PlayerScreen — Top-level player mode component.
 *
 * Manages game phases: character creation -> gameplay -> game over.
 * Uses the useGameEngine hook to drive the engine state machine.
 */

import { useState } from 'react';
import type { Story } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';
import { useGameEngine, type GameEngineOptions } from '../../hooks/useGameEngine';
import { CharacterCreation } from './CharacterCreation';
import { GameRenderer, GameOverScreen } from './GameRenderer';
import { PauseMenu } from './PauseMenu';

interface PlayerScreenProps {
  story: Story;
  onExit: () => void;
  /** Options for playtesting (start from node, debug mode) */
  engineOptions?: GameEngineOptions;
}

export function PlayerScreen({ story, onExit, engineOptions }: PlayerScreenProps) {
  const game = useGameEngine(story, engineOptions);
  const [paused, setPaused] = useState(false);

  const gameTitle = story.manifest.title || 'Untitled';

  switch (game.phase) {
    case 'characterCreation':
      return (
        <CharacterCreation
          config={game.creationConfig}
          character={game.draftCharacter}
          pointsRemaining={game.pointsRemaining}
          validation={game.characterValidation}
          onSetName={game.onSetName}
          onIncrease={game.onIncrease}
          onDecrease={game.onDecrease}
          onStart={() => game.onStartGame()}
          onSkip={game.onSkipCreation}
        />
      );

    case 'playing':
      if (!game.currentNode || !isDialogueNode(game.currentNode)) {
        return (
          <div className="player-screen">
            <div className="player-panel">
              <p>Error: Current node not found.</p>
              <button className="btn" onClick={onExit}>Exit</button>
            </div>
          </div>
        );
      }
      return (
        <>
          <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 50, display: 'flex', gap: 8 }}>
            {engineOptions && (
              <button
                className={`game-pause-btn ${game.debugMode ? 'active' : ''}`}
                onClick={() => game.setDebugMode(!game.debugMode)}
                title={game.debugMode ? 'Disable debug mode' : 'Enable debug mode'}
                style={{ position: 'static' }}
              >
                {game.debugMode ? 'DBG' : 'dbg'}
              </button>
            )}
            <button
              className="game-pause-btn"
              onClick={() => setPaused(true)}
              title="Pause"
              style={{ position: 'static' }}
            >
              &#9776;
            </button>
          </div>
          <GameRenderer
            story={game.story}
            currentNode={game.currentNode}
            narrativeLog={game.narrativeLog}
            availableChoices={game.availableChoices}
            allChoices={game.allChoices}
            gameState={game.gameState}
            debugMode={game.debugMode}
            onDebugToggle={game.setDebugMode}
            onMakeChoice={game.onMakeChoice}
          />
          {paused && (
            <PauseMenu
              gameTitle={gameTitle}
              gameState={game.gameState}
              onResume={() => setPaused(false)}
              onLoadState={(state) => {
                game.onLoadState(state);
                setPaused(false);
              }}
              onRestart={() => {
                game.onRestart();
                setPaused(false);
              }}
              onExit={onExit}
            />
          )}
        </>
      );

    case 'gameOver':
      return (
        <GameOverScreen
          gameState={game.gameState}
          story={game.story}
          onRestart={game.onRestart}
          onExit={onExit}
        />
      );
  }
}
