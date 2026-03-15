/**
 * RegionCommentNode — Blueprint-style region comment for the canvas.
 *
 * Renders as a labeled rectangle behind story nodes.
 * Header bar is the drag handle; bottom-right corner has a permanent resize control.
 * Resize persistence is handled by StoryCanvas via onNodesChange dimension events.
 * Right-click uses the normal canvas context menu (via event bubbling).
 */

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { NodeResizeControl, type NodeProps } from '@xyflow/react';
import { REGION_COLORS } from './CanvasContextMenu';

export interface RegionCommentData {
  [key: string]: unknown;
  label: string;
  color?: string;
  width: number;
  height: number;
  onLabelChange?: (id: string, label: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
}

function RegionCommentNode({ id, data, selected }: NodeProps & { data: RegionCommentData }) {
  const { label, color, onLabelChange } = data;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(label);
    setEditing(true);
  }, [label]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== label) {
      onLabelChange?.(id, trimmed);
    }
  }, [editValue, label, id, onLabelChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'Escape') {
      setEditValue(label);
      setEditing(false);
    }
  }, [label]);

  const accentColor = color || REGION_COLORS[0].value;

  return (
    <>
      {/* Always-visible resize control in the bottom-right corner */}
      <NodeResizeControl
        position="bottom-right"
        minWidth={150}
        minHeight={80}
        className="nopan"
        style={{
          background: 'transparent',
          border: 'none',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block' }}
        >
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </NodeResizeControl>
      <div
        className={`region-comment ${selected ? 'selected' : ''}`}
        style={{
          width: '100%',
          height: '100%',
          borderColor: accentColor,
          backgroundColor: `color-mix(in srgb, ${accentColor} 12%, var(--color-bg))`,
        }}
      >
        <div
          className="region-comment-header drag-handle"
          style={{ backgroundColor: accentColor }}
          onDoubleClick={handleDoubleClick}
        >
          {editing ? (
            <input
              ref={inputRef}
              className="region-comment-input"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <span className="region-comment-label">{label}</span>
          )}
        </div>
      </div>
    </>
  );
}

export const RegionCommentNode_Memo = memo(RegionCommentNode);
