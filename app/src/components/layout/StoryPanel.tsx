/**
 * StoryPanel — Story statistics and outline view.
 *
 * Shows node counts, word counts, and a navigable outline of the story graph.
 */

import { useMemo } from 'react';
import type { Story } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';
import { getReachableNodes } from '@engine/engine/editor.js';

interface StoryPanelProps {
  story: Story;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function StoryPanel({ story, selectedNodeId, onSelectNode }: StoryPanelProps) {
  const stats = useMemo(() => {
    const nodes = Object.values(story.nodes);
    const reachable = getReachableNodes(story);
    const orphanCount = nodes.length - reachable.size;

    let totalChoices = 0;
    let wordCount = 0;
    let terminalCount = 0;

    for (const node of nodes) {
      if (isDialogueNode(node)) {
        totalChoices += node.choices.length;
        wordCount += node.text.split(/\s+/).filter(Boolean).length;
        if (node.choices.length === 0) terminalCount++;
      }
    }

    const entityCount =
      Object.keys(story.attributes).length +
      Object.keys(story.resources).length +
      Object.keys(story.items ?? {}).length +
      Object.keys(story.abilities ?? {}).length +
      Object.keys(story.traits ?? {}).length +
      Object.keys(story.companions ?? {}).length;

    return { totalNodes: nodes.length, reachable: reachable.size, orphanCount, totalChoices, wordCount, terminalCount, entityCount };
  }, [story]);

  // Build outline: start node first, then BFS order, orphans at end
  const outline = useMemo(() => {
    const reachable = getReachableNodes(story);
    const visited = new Set<string>();
    const ordered: string[] = [];

    // BFS from start
    const queue = [story.manifest.startNode];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      ordered.push(id);

      const node = story.nodes[id];
      if (!node) continue;
      if (isDialogueNode(node)) {
        for (const choice of node.choices) {
          if (!visited.has(choice.next)) queue.push(choice.next);
        }
      } else if (node.type === 'characterCreation' && !visited.has(node.next)) {
        queue.push(node.next);
      }
    }

    // Orphans
    const orphans: string[] = [];
    for (const id of Object.keys(story.nodes)) {
      if (!visited.has(id)) orphans.push(id);
    }

    return { ordered, orphans };
  }, [story]);

  return (
    <div className="sidebar-content">
      {/* Statistics */}
      <div className="story-stats">
        <div className="story-stats-title">Statistics</div>
        <div className="story-stats-grid">
          <StatRow label="Nodes" value={stats.totalNodes} />
          <StatRow label="Reachable" value={stats.reachable} />
          {stats.orphanCount > 0 && (
            <StatRow label="Orphaned" value={stats.orphanCount} warn />
          )}
          <StatRow label="Choices" value={stats.totalChoices} />
          <StatRow label="Endings" value={stats.terminalCount} />
          <StatRow label="Words" value={stats.wordCount} />
          <StatRow label="Entities" value={stats.entityCount} />
        </div>
      </div>

      {/* Outline */}
      <div className="story-outline">
        <div className="story-stats-title">Outline</div>
        {outline.ordered.map((id) => {
          const node = story.nodes[id];
          if (!node) return null;
          const isStart = id === story.manifest.startNode;
          const isTerminal = isDialogueNode(node) && node.choices.length === 0;
          const isCharCreation = node.type === 'characterCreation';

          return (
            <button
              key={id}
              className={`story-outline-item ${id === selectedNodeId ? 'active' : ''}`}
              onClick={() => onSelectNode(id)}
            >
              <span className="story-outline-item-name">
                {node.name || id}
              </span>
              <span className="story-outline-item-badges">
                {isStart && <span className="story-node-badge start" style={{ fontSize: 9 }}>START</span>}
                {isCharCreation && <span className="story-node-badge" style={{ fontSize: 9, background: 'var(--color-primary)' }}>CHAR</span>}
                {isTerminal && <span className="story-node-badge" style={{ fontSize: 9, background: 'var(--color-warning)' }}>END</span>}
              </span>
            </button>
          );
        })}

        {outline.orphans.length > 0 && (
          <>
            <div style={{ fontSize: 11, color: 'var(--color-warning)', padding: '8px 8px 4px', fontWeight: 600 }}>
              Orphaned Nodes ({outline.orphans.length})
            </div>
            {outline.orphans.map((id) => {
              const node = story.nodes[id];
              if (!node) return null;
              return (
                <button
                  key={id}
                  className={`story-outline-item orphan ${id === selectedNodeId ? 'active' : ''}`}
                  onClick={() => onSelectNode(id)}
                >
                  <span className="story-outline-item-name">{node.name || id}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

function StatRow({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="story-stat-row">
      <span className="story-stat-label">{label}</span>
      <span className={`story-stat-value ${warn ? 'warn' : ''}`}>{value}</span>
    </div>
  );
}
