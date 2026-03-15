/**
 * SearchPalette — Quick-find command palette for nodes.
 *
 * Triggered by Cmd/Ctrl+K or the search button in the toolbar.
 * Searches node names, text content, and IDs.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import type { Story, StoryNode } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';

interface SearchPaletteProps {
  story: Story;
  onSelect: (nodeId: string) => void;
  onClose: () => void;
}

interface SearchResult {
  node: StoryNode;
  matchField: 'name' | 'text' | 'id';
}

export function SearchPalette({ story, onSelect, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results: SearchResult[] = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      // Show all nodes when empty, sorted by name
      return Object.values(story.nodes).map((node) => ({
        node,
        matchField: 'name' as const,
      }));
    }

    const matches: SearchResult[] = [];
    for (const node of Object.values(story.nodes)) {
      if (node.name?.toLowerCase().includes(q)) {
        matches.push({ node, matchField: 'name' });
      } else if (isDialogueNode(node) && node.text.toLowerCase().includes(q)) {
        matches.push({ node, matchField: 'text' });
      } else if (node.id.toLowerCase().includes(q)) {
        matches.push({ node, matchField: 'id' });
      }
    }
    return matches;
  }, [query, story]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(0);
  }, [results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      onSelect(results[activeIndex].node.id);
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <>
      <div className="search-palette-backdrop" onClick={onClose} />
      <div className="search-palette" onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          className="search-palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search nodes by name, text, or ID..."
        />
        <div className="search-palette-results">
          {results.length === 0 ? (
            <div className="search-palette-empty">No matching nodes</div>
          ) : (
            results.map((result, i) => {
              const isStart = result.node.id === story.manifest.startNode;
              const isCharCreation = result.node.type === 'characterCreation';
              const isTerminal = isDialogueNode(result.node) && result.node.choices.length === 0;
              const textPreview = isDialogueNode(result.node)
                ? result.node.text.slice(0, 80) + (result.node.text.length > 80 ? '...' : '')
                : undefined;

              return (
                <button
                  key={result.node.id}
                  className={`search-palette-item ${i === activeIndex ? 'active' : ''}`}
                  onClick={() => { onSelect(result.node.id); onClose(); }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  <span className="search-palette-item-name">
                    {result.node.name || result.node.id}
                  </span>
                  {textPreview && (
                    <span className="search-palette-item-preview">{textPreview}</span>
                  )}
                  <span className="search-palette-item-badges">
                    {isStart && <span className="story-node-badge start">START</span>}
                    {isCharCreation && <span className="story-node-badge" style={{ background: 'var(--color-primary)' }}>CHAR</span>}
                    {isTerminal && <span className="story-node-badge" style={{ background: 'var(--color-warning)' }}>END</span>}
                    {result.matchField !== 'name' && (
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        matched {result.matchField}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
