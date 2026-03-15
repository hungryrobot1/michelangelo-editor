#!/usr/bin/env node
/**
 * Michelangelo CLI Player (Ink)
 *
 * Self-contained terminal player for an interactive fiction game.
 * Story data is injected at export time via the __STORY_DATA__ placeholder.
 *
 * Usage: node <this-file>.js
 */

import React, { useState, useEffect, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import {
  GameEngine,
  createBlankCharacter,
  getCreationConfig,
  calculatePointsRemaining,
  increaseAttribute,
  decreaseAttribute,
  finalizeCharacter,
  validateCharacter,
} from '../../src/engine/index.js';
import type {
  Story,
  GameState,
  PlayerCharacter,
  AttributeDefinition,
  Choice,
} from '../../src/types/index.js';

// Story data is provided as a virtual module by the esbuild plugin at export time
import story from 'game:story-data';

// ─── Helpers ───────────────────────────────────────────────────────

function wordWrap(text: string, width: number): string {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line.length + word.length + 1 > width && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

// ─── Character Creation Screen ─────────────────────────────────────

interface CharCreationProps {
  story: Story;
  onComplete: (character: PlayerCharacter) => void;
}

function CharacterCreation({ story, onComplete }: CharCreationProps) {
  const config = getCreationConfig(story);
  const [phase, setPhase] = useState<'name' | 'attributes' | 'done'>('name');
  const [name, setName] = useState('');
  const [attributes, setAttributes] = useState(() => {
    const blank = createBlankCharacter(config);
    return { ...blank.attributes };
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [message, setMessage] = useState('');

  const remaining = useMemo(
    () => calculatePointsRemaining(attributes, config),
    [attributes, config]
  );

  useInput((input, key) => {
    if (phase === 'name') {
      if (key.return && name.trim()) {
        if (config.attributes.length === 0) {
          onComplete(finalizeCharacter(name.trim(), attributes, {}, undefined));
          return;
        }
        setPhase('attributes');
      } else if (key.backspace || key.delete) {
        setName((n) => n.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setName((n) => n + input);
      }
    } else if (phase === 'attributes') {
      if (key.upArrow) {
        setSelectedIdx((i) => Math.max(0, i - 1));
        setMessage('');
      } else if (key.downArrow) {
        setSelectedIdx((i) => Math.min(config.attributes.length - 1, i + 1));
        setMessage('');
      } else if (key.rightArrow || input === '+') {
        const attrDef = config.attributes[selectedIdx]!;
        const result = increaseAttribute(attributes, attrDef.id, config);
        if (result.success) {
          setAttributes(result.newAttributes!);
          setMessage('');
        } else {
          setMessage(result.error ?? '');
        }
      } else if (key.leftArrow || input === '-') {
        const attrDef = config.attributes[selectedIdx]!;
        const result = decreaseAttribute(attributes, attrDef.id, config);
        if (result.success) {
          setAttributes(result.newAttributes!);
          setMessage('');
        } else {
          setMessage(result.error ?? '');
        }
      } else if (key.return) {
        const resources: Record<string, number> = {};
        for (const resDef of config.resources) {
          resources[resDef.id] = resDef.default;
        }
        const character = finalizeCharacter(name.trim(), attributes, resources, undefined);
        const validation = validateCharacter(character, config);
        if (!validation.valid) {
          setMessage(validation.errors.join(', '));
          return;
        }
        onComplete(character);
      }
    }
  });

  if (phase === 'name') {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">═══ CHARACTER CREATION ═══</Text>
        <Text> </Text>
        <Text>Enter your character name:</Text>
        <Text> </Text>
        <Text bold color="green">{'> '}{name}<Text color="gray">_</Text></Text>
        {name.trim() && <Text dimColor>(press Enter to confirm)</Text>}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">═══ CHARACTER CREATION ═══</Text>
      <Text> </Text>
      <Text>Character: <Text bold>{name}</Text></Text>
      <Text>Points remaining: <Text bold color={remaining > 0 ? 'yellow' : 'green'}>{remaining}</Text></Text>
      <Text dimColor>Use ↑↓ to select, ←→ to adjust, Enter to confirm</Text>
      <Text> </Text>
      {config.attributes.map((attrDef: AttributeDefinition, i: number) => {
        const value = attributes[attrDef.id] ?? attrDef.base;
        const selected = i === selectedIdx;
        return (
          <Text key={attrDef.id}>
            <Text color={selected ? 'cyan' : undefined} bold={selected}>
              {selected ? '▸ ' : '  '}
              {attrDef.name.padEnd(14)}
            </Text>
            <Text bold>{String(value).padStart(2)}</Text>
            <Text dimColor>  {attrDef.description ?? ''}</Text>
          </Text>
        );
      })}
      {message && (
        <>
          <Text> </Text>
          <Text color="yellow">{message}</Text>
        </>
      )}
      <Text> </Text>
      <Text dimColor>Press Enter when done{remaining > 0 ? ` (${remaining} points unspent)` : ''}</Text>
    </Box>
  );
}

// ─── Status Display ────────────────────────────────────────────────

function StatusBar({ state, engine }: { state: GameState; engine: GameEngine }) {
  const story = engine.getStory();
  const player = state.player;
  const resourceDefs = Object.values(story.resources);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="cyan">{player.name}</Text>
      <Box gap={2} flexWrap="wrap">
        {resourceDefs.map((resDef) => {
          const value = player.resources[resDef.id] ?? resDef.default;
          const maxVal = resDef.max ?? resDef.default;
          const barLen = 8;
          const filled = maxVal > 0 ? Math.max(0, Math.min(barLen, Math.round((value / maxVal) * barLen))) : barLen;
          return (
            <Text key={resDef.id}>
              <Text dimColor>{resDef.name.slice(0, 3).toUpperCase()}: </Text>
              <Text color="green">{'█'.repeat(filled)}</Text>
              <Text dimColor>{'░'.repeat(barLen - filled)}</Text>
              <Text> {value}</Text>
            </Text>
          );
        })}
      </Box>
      {player.items.length > 0 && (
        <Text dimColor>
          Items: {player.items.map((s) => {
            const item = engine.getItem(s.itemId);
            return (item?.name ?? s.itemId) + (s.quantity > 1 ? ` x${s.quantity}` : '');
          }).join(', ')}
        </Text>
      )}
    </Box>
  );
}

// ─── Main Game Screen ──────────────────────────────────────────────

type Screen = 'playing' | 'charCreation' | 'status' | 'gameOver';

function Game() {
  const { exit } = useApp();
  const [engine] = useState(() => new GameEngine(story));
  const [screen, setScreen] = useState<Screen>('playing');
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);

  const [selectedChoice, setSelectedChoice] = useState(0);

  // Start the game
  useEffect(() => {
    engine.start();
    const node = engine.getCurrentNode();
    if (node && node.type === 'characterCreation') {
      setScreen('charCreation');
    }
    rerender();
  }, []);

  const node = engine.getCurrentNode();
  const state = engine.getState();
  const choices = engine.getAvailableChoices();

  useInput((input, key) => {
    if (screen === 'charCreation') return; // handled by CharacterCreation component

    if (screen === 'status') {
      // Any key returns to game
      setScreen('playing');
      return;
    }

    if (screen === 'gameOver') {
      if (input === 'r') {
        engine.start();
        const n = engine.getCurrentNode();
        if (n && n.type === 'characterCreation') {
          setScreen('charCreation');
        } else {
          setScreen('playing');
        }
        setSelectedChoice(0);
        rerender();
      } else if (input === 'q' || key.escape) {
        exit();
      }
      return;
    }

    // Playing screen
    if (input === 'q' || key.escape) {
      exit();
      return;
    }

    if (input === 's' || input === 'i') {
      setScreen('status');
      return;
    }

    if (choices.length > 0) {
      if (key.upArrow) {
        setSelectedChoice((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedChoice((i) => Math.min(choices.length - 1, i + 1));
      } else if (key.return) {
        const newNode = engine.makeChoice(selectedChoice);
        setSelectedChoice(0);
        if (newNode && newNode.type === 'characterCreation') {
          setScreen('charCreation');
        } else if (engine.isGameOver()) {
          setScreen('gameOver');
        }
        rerender();
      }
    }
  });

  const handleCharCreationComplete = (character: PlayerCharacter) => {
    engine.completeCharacterCreation(character);
    if (engine.isGameOver()) {
      setScreen('gameOver');
    } else {
      setScreen('playing');
    }
    setSelectedChoice(0);
    rerender();
  };

  if (screen === 'charCreation') {
    return <CharacterCreation story={story} onComplete={handleCharCreationComplete} />;
  }

  if (!node) {
    return (
      <Box padding={1}>
        <Text color="red">Error: current node not found.</Text>
      </Box>
    );
  }

  if (screen === 'status') {
    return (
      <Box flexDirection="column" padding={1}>
        <StatusBar state={state} engine={engine} />
        <Text> </Text>
        <Box flexDirection="column">
          <Text bold dimColor>Attributes</Text>
          {Object.values(story.attributes).map((attrDef) => {
            const value = state.player.attributes[attrDef.id] ?? attrDef.base;
            return (
              <Text key={attrDef.id}>  {attrDef.name}: <Text bold>{value}</Text></Text>
            );
          })}
        </Box>
        {state.player.traits.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold dimColor>Traits</Text>
            <Text>  {state.player.traits.map((id) => engine.getTrait(id)?.name ?? id).join(', ')}</Text>
          </Box>
        )}
        {state.player.abilities.length > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold dimColor>Abilities</Text>
            <Text>  {state.player.abilities.map((id) => engine.getAbility(id)?.name ?? id).join(', ')}</Text>
          </Box>
        )}
        <Text> </Text>
        <Text dimColor>Press any key to return</Text>
      </Box>
    );
  }

  if (screen === 'gameOver') {
    return (
      <Box flexDirection="column" padding={1}>
        <StatusBar state={state} engine={engine} />
        <Text> </Text>
        {node.type === 'dialogue' && (
          <Text>{wordWrap(node.text, 70)}</Text>
        )}
        <Text> </Text>
        <Text bold color="cyan">═══ THE END ═══</Text>
        <Text> </Text>
        <Text><Text bold>r</Text> - Restart   <Text bold>q</Text> - Quit</Text>
      </Box>
    );
  }

  // Playing screen
  return (
    <Box flexDirection="column" padding={1}>
      <StatusBar state={state} engine={engine} />
      <Text> </Text>

      {node.type === 'dialogue' && (
        <>
          {node.image && <Text dimColor>[Image: {node.image}]</Text>}
          <Text>{wordWrap(node.text, 70)}</Text>
        </>
      )}

      {choices.length > 0 && (
        <>
          <Text> </Text>
          <Text color="yellow">What do you do?</Text>
          <Text> </Text>
          {choices.map((choice: Choice, i: number) => {
            const selected = i === selectedChoice;
            return (
              <Text key={i}>
                <Text color={selected ? 'cyan' : undefined} bold={selected}>
                  {selected ? '▸ ' : '  '}{i + 1}. {choice.text}
                </Text>
              </Text>
            );
          })}
        </>
      )}

      <Text> </Text>
      <Text dimColor>↑↓ select · Enter choose · s status · q quit</Text>
    </Box>
  );
}

// ─── Entry ─────────────────────────────────────────────────────────

function App() {
  return (
    <Box flexDirection="column">
      <Box justifyContent="center" paddingY={1}>
        <Text bold color="cyan">{story.manifest.title}</Text>
      </Box>
      {story.manifest.description && (
        <Box justifyContent="center" marginBottom={1}>
          <Text italic dimColor>{story.manifest.description}</Text>
        </Box>
      )}
      <Game />
    </Box>
  );
}

render(<App />);
