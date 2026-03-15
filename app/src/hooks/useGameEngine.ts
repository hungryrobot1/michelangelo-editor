/**
 * useGameEngine — React hook wrapping the GameEngine class.
 *
 * Provides reactive state updates for the game engine, handling
 * node transitions, choice selection, and character creation.
 *
 * Character creation is now driven by node type: when the engine
 * lands on a characterCreation node, the hook exposes creation state.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Story, PlayerCharacter, StoryNode, Choice, GameState } from '@engine/types/index.js';
import { isDialogueNode, isCharacterCreationNode } from '@engine/types/index.js';
import { GameEngine } from '@engine/engine/engine.js';
import { describeEffect } from '@engine/engine/effects.js';
import {
  getCreationConfig,
  createBlankCharacter,
  createDefaultCharacter,
  increaseAttribute,
  decreaseAttribute,
  calculatePointsRemaining,
  validateCharacter,
  finalizeCharacter,
  type CharacterCreationConfig,
} from '@engine/engine/character.js';

export type GamePhase = 'characterCreation' | 'playing' | 'gameOver';

export interface NarrativeEntry {
  nodeId: string;
  nodeName?: string;
  text: string;
  chosenText?: string;
  effects?: string[];
}

export interface GameEngineOptions {
  /** Start from a specific node instead of the beginning */
  startFromNodeId?: string;
  /** Enable debug mode (shows all choices, state inspector) */
  debugMode?: boolean;
}

export function useGameEngine(story: Story, options?: GameEngineOptions) {
  const engineRef = useRef<GameEngine>(new GameEngine(story));
  const [, forceUpdate] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [debugMode, setDebugMode] = useState(options?.debugMode ?? false);
  const [narrativeLog, setNarrativeLog] = useState<NarrativeEntry[]>([]);

  const engine = engineRef.current;

  // Force a re-render after engine state changes
  const refresh = useCallback(() => forceUpdate((n) => n + 1), []);

  // Start the game on first render (enters the start node or specified node)
  if (!gameStarted) {
    if (options?.startFromNodeId) {
      engine.startFromNode(options.startFromNodeId);
    } else {
      engine.start();
    }
    setGameStarted(true);
    // Seed the narrative log is not needed here — the current node
    // is always rendered live, not from the log.
  }

  // ── Determine phase from current node type ──
  const currentNode = engine.getCurrentNode();
  const isCharCreationNode = currentNode && isCharacterCreationNode(currentNode);
  const isGameOverState = currentNode && isDialogueNode(currentNode) && engine.isGameOver();

  const phase: GamePhase = isCharCreationNode
    ? 'characterCreation'
    : isGameOverState
      ? 'gameOver'
      : 'playing';

  // ── Character Creation ──

  const creationConfig = useMemo(() => getCreationConfig(story), [story]);

  const [draftCharacter, setDraftCharacter] = useState<PlayerCharacter>(() =>
    createBlankCharacter(creationConfig)
  );

  const handleIncrease = useCallback((attributeId: string) => {
    const result = increaseAttribute(draftCharacter.attributes, attributeId, creationConfig);
    if (result.success && result.newAttributes) {
      setDraftCharacter((prev) => ({ ...prev, attributes: result.newAttributes! }));
    }
  }, [draftCharacter.attributes, creationConfig]);

  const handleDecrease = useCallback((attributeId: string) => {
    const result = decreaseAttribute(draftCharacter.attributes, attributeId, creationConfig);
    if (result.success && result.newAttributes) {
      setDraftCharacter((prev) => ({ ...prev, attributes: result.newAttributes! }));
    }
  }, [draftCharacter.attributes, creationConfig]);

  const handleSetName = useCallback((name: string) => {
    setDraftCharacter((prev) => ({ ...prev, name }));
  }, []);

  const pointsRemaining = useMemo(
    () => calculatePointsRemaining(draftCharacter.attributes, creationConfig),
    [draftCharacter.attributes, creationConfig]
  );

  const characterValidation = useMemo(
    () => validateCharacter(draftCharacter, creationConfig),
    [draftCharacter, creationConfig]
  );

  const handleStartGame = useCallback((character?: PlayerCharacter) => {
    const player = character ?? draftCharacter;
    const finalized = finalizeCharacter(
      player.name || 'Adventurer',
      player.attributes,
      player.resources,
    );
    engine.completeCharacterCreation(finalized);
    refresh();
  }, [draftCharacter, engine, refresh]);

  const handleSkipCreation = useCallback(() => {
    const defaultChar = createDefaultCharacter(story);
    engine.completeCharacterCreation(defaultChar);
    refresh();
  }, [story, engine, refresh]);

  // ── Gameplay ──

  const handleMakeChoice = useCallback((choiceIndex: number) => {
    // Snapshot current node into the narrative log before advancing
    const node = engine.getCurrentNode();
    const choices = engine.getAvailableChoices();
    const chosenChoice = choices[choiceIndex];
    if (node && isDialogueNode(node)) {
      setNarrativeLog((prev) => [
        ...prev,
        {
          nodeId: node.id,
          nodeName: node.name,
          text: node.text,
          chosenText: chosenChoice?.text,
        },
      ]);
    }
    engine.makeChoice(choiceIndex);

    // Collect effect descriptions from choice effects + new node's onEnter effects
    const effectDescriptions: string[] = [];
    if (chosenChoice?.effects) {
      for (const eff of chosenChoice.effects) {
        effectDescriptions.push(describeEffect(eff, story));
      }
    }
    const newNode = engine.getCurrentNode();
    if (newNode && isDialogueNode(newNode) && newNode.onEnter) {
      for (const eff of newNode.onEnter) {
        effectDescriptions.push(describeEffect(eff, story));
      }
    }
    if (effectDescriptions.length > 0) {
      setNarrativeLog((prev) => {
        const last = prev[prev.length - 1];
        if (last) {
          const updated = [...prev];
          updated[updated.length - 1] = { ...last, effects: effectDescriptions };
          return updated;
        }
        return prev;
      });
    }

    refresh();
  }, [engine, story, refresh]);

  const handleRestart = useCallback(() => {
    setDraftCharacter(createBlankCharacter(creationConfig));
    setNarrativeLog([]);
    engine.start();
    refresh();
  }, [engine, creationConfig, refresh]);

  const handleLoadState = useCallback((savedState: GameState) => {
    // Restore engine to saved state by replacing its internal state
    (engine as any).state = savedState;
    refresh();
  }, [engine, refresh]);

  // ── Computed state ──

  const gameState = engine.getState();
  const availableChoices = phase === 'playing' ? engine.getAvailableChoices() : [];
  const allChoices = phase === 'playing' && debugMode ? engine.getAllChoices() : undefined;

  return {
    // Phase
    phase,

    // Character creation
    creationConfig,
    draftCharacter,
    pointsRemaining,
    characterValidation,
    onSetName: handleSetName,
    onIncrease: handleIncrease,
    onDecrease: handleDecrease,
    onStartGame: handleStartGame,
    onSkipCreation: handleSkipCreation,

    // Gameplay
    story,
    currentNode,
    narrativeLog,
    availableChoices,
    allChoices,
    gameState,
    onMakeChoice: handleMakeChoice,
    onRestart: handleRestart,
    onLoadState: handleLoadState,
    engine,

    // Debug
    debugMode,
    setDebugMode,
  };
}
