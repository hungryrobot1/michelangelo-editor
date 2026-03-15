/**
 * StoryCanvas — React Flow viewport for the story graph.
 *
 * Renders story nodes as custom React Flow nodes with edges
 * derived from choice.next references.
 */

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type OnNodesChange,
  type NodeTypes,
  type Connection,
  BackgroundVariant,
} from '@xyflow/react';
import type { Story, RegionComment } from '@engine/types/index.js';
import { isDialogueNode } from '@engine/types/index.js';
import { StoryNodeComponent_Memo, type StoryNodeData } from './StoryNode';
import { RegionCommentNode_Memo, type RegionCommentData } from './RegionCommentNode';

const nodeTypes: NodeTypes = {
  storyNode: StoryNodeComponent_Memo as any,
  regionComment: RegionCommentNode_Memo as any,
};

export interface ContextMenuEvent {
  position: { x: number; y: number };
  flowPosition: { x: number; y: number };
  nodeId?: string;
}

interface StoryCanvasProps {
  story: Story;
  selectedNodeId: string | null;
  showGrid?: boolean;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodePosition: (nodeId: string, position: { x: number; y: number }) => void;
  onConnect?: (sourceId: string, targetId: string) => void;
  onRegisterGetViewportCenter?: (fn: () => { x: number; y: number }) => void;
  onRegisterPanToNode?: (fn: (nodeId: string) => void) => void;
  onContextMenu?: (event: ContextMenuEvent) => void;
  onUpdateRegionComment?: (id: string, updates: Partial<Omit<RegionComment, 'id'>>) => void;
  onDeleteRegionComment?: (id: string) => void;
}

/**
 * Build the full React Flow node array from story data.
 * Extracted so we can call it once on story/selection changes without
 * recreating nodes every drag frame.
 */
function buildNodes(
  story: Story,
  selectedNodeId: string | null,
  onUpdateRegionComment?: (id: string, updates: Partial<Omit<RegionComment, 'id'>>) => void,
)  {
  const regionNodes = (story.regionComments ?? []).map((comment) => {
    const data: RegionCommentData = {
      label: comment.label,
      color: comment.color,
      width: comment.size.width,
      height: comment.size.height,
      onLabelChange: onUpdateRegionComment
        ? (cid: string, newLabel: string) => onUpdateRegionComment(cid, { label: newLabel })
        : undefined,
      onResize: onUpdateRegionComment
        ? (cid: string, w: number, h: number) => onUpdateRegionComment(cid, { size: { width: w, height: h } })
        : undefined,
    };
    return {
      id: comment.id,
      type: 'regionComment',
      position: comment.position,
      data,
      style: { zIndex: -1, width: comment.size.width, height: comment.size.height },
      draggable: true,
      selectable: true,
      dragHandle: '.drag-handle',
    };
  });

  const storyNodes = Object.values(story.nodes).map((storyNode) => {
    const data: StoryNodeData = {
      storyNode,
      isStartNode: storyNode.id === story.manifest.startNode,
      isTerminal: isDialogueNode(storyNode) ? storyNode.choices.length === 0 : false,
      isSelected: storyNode.id === selectedNodeId,
    };
    return {
      id: storyNode.id,
      type: 'storyNode',
      position: storyNode.editorPosition ?? { x: 0, y: 0 },
      data,
      selected: storyNode.id === selectedNodeId,
    };
  });

  // Region comments first so they render behind story nodes
  return [...regionNodes, ...storyNodes] as Node[];
}

export function StoryCanvas({
  story,
  selectedNodeId,
  showGrid,
  onSelectNode,
  onUpdateNodePosition,
  onConnect,
  onRegisterGetViewportCenter,
  onRegisterPanToNode,
  onContextMenu,
  onUpdateRegionComment,
  onDeleteRegionComment,
}: StoryCanvasProps) {
  const { screenToFlowPosition, setCenter } = useReactFlow();

  // Register viewport center getter for external use (e.g. Toolbar "Add Node")
  useEffect(() => {
    if (!onRegisterGetViewportCenter) return;
    onRegisterGetViewportCenter(() => {
      const canvas = document.querySelector('.app-canvas');
      if (!canvas) return { x: 200, y: 200 };
      const rect = canvas.getBoundingClientRect();
      return screenToFlowPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    });
  }, [onRegisterGetViewportCenter, screenToFlowPosition]);

  // Register panToNode for search result navigation
  useEffect(() => {
    if (!onRegisterPanToNode) return;
    onRegisterPanToNode((nodeId: string) => {
      const node = story.nodes[nodeId];
      if (!node?.editorPosition) return;
      setCenter(node.editorPosition.x + 100, node.editorPosition.y + 50, { duration: 400, zoom: 1 });
    });
  }, [onRegisterPanToNode, story.nodes, setCenter]);

  // Context menu handlers
  const handlePaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      event.preventDefault();
      if (!onContextMenu) return;
      onContextMenu({
        position: { x: event.clientX, y: event.clientY },
        flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      });
    },
    [onContextMenu, screenToFlowPosition]
  );

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      if (!onContextMenu) return;
      onSelectNode(node.id);
      onContextMenu({
        position: { x: event.clientX, y: event.clientY },
        flowPosition: screenToFlowPosition({ x: event.clientX, y: event.clientY }),
        nodeId: node.id,
      });
    },
    [onContextMenu, onSelectNode, screenToFlowPosition]
  );

  // ── Local nodes state ──────────────────────────────────────────────
  // React Flow controlled mode: we maintain a local nodes array and let
  // applyNodeChanges handle position/dimension updates incrementally.
  // Only the affected node gets a new reference each frame, so memo'd
  // components for other nodes skip re-rendering.
  const [nodes, setNodes] = useState<Node[]>(() =>
    buildNodes(story, selectedNodeId, onUpdateRegionComment)
  );

  // Keep a ref to onUpdateRegionComment so handleNodesChange doesn't
  // need it as a dependency (which would cause circular rebuilds).
  const onUpdateRegionCommentRef = useRef(onUpdateRegionComment);
  onUpdateRegionCommentRef.current = onUpdateRegionComment;

  // Sync story/selection changes → local nodes.
  // This replaces the old useMemo approach; it only runs when the
  // story data or selection actually changes — NOT during drag.
  useEffect(() => {
    setNodes(buildNodes(story, selectedNodeId, onUpdateRegionCommentRef.current));
  }, [story, selectedNodeId]);

  // ── Handle node changes (drag, resize, selection) ──────────────────
  // Keep refs for callbacks used inside handleNodesChange so the
  // handler itself has a stable identity (no deps on these callbacks).
  const onUpdateNodePositionRef = useRef(onUpdateNodePosition);
  onUpdateNodePositionRef.current = onUpdateNodePosition;
  const storyRef = useRef(story);
  storyRef.current = story;

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Let React Flow apply all changes incrementally (position, dimensions, selection).
      // applyNodeChanges only creates new references for changed nodes.
      setNodes((prev) => applyNodeChanges(changes, prev));

      const regionIds = new Set(
        (storyRef.current.regionComments ?? []).map((c) => c.id)
      );

      // Persist final position on drag end
      for (const change of changes) {
        if (change.type === 'position' && change.dragging === false && change.position) {
          if (regionIds.has(change.id)) {
            onUpdateRegionCommentRef.current?.(change.id, { position: change.position });
          } else {
            onUpdateNodePositionRef.current(change.id, change.position);
          }
        }
      }

      // Persist region dimensions on resize end.
      // Check `=== false` not `!change.resizing` — React Flow fires
      // dimension changes for initial measurement (resizing: undefined)
      // and treating those as resize-end would cause an infinite loop.
      for (const change of changes) {
        if (change.type === 'dimensions' && change.dimensions && regionIds.has(change.id)) {
          const { width, height } = change.dimensions;
          if (width != null && height != null && change.resizing === false) {
            onUpdateRegionCommentRef.current?.(change.id, {
              size: { width: Math.round(width), height: Math.round(height) },
            });
          }
        }
      }
    },
    [] // stable — all external deps accessed via refs
  );

  // Convert choices to edges
  const edges: Edge[] = useMemo(() => {
    const result: Edge[] = [];
    for (const node of Object.values(story.nodes)) {
      if (isDialogueNode(node)) {
        for (let i = 0; i < node.choices.length; i++) {
          const choice = node.choices[i]!;
          result.push({
            id: `${node.id}-${i}-${choice.next}`,
            source: node.id,
            target: choice.next,
            label: choice.text.length > 25 ? choice.text.slice(0, 24) + '\u2026' : choice.text,
            animated: !!choice.condition,
            style: { strokeWidth: 2 },
            labelStyle: { fontSize: 11, fill: 'var(--color-text-dim)' },
            labelBgStyle: { fill: 'var(--color-bg)', fillOpacity: 0.9 },
            labelBgPadding: [6, 3] as [number, number],
            labelBgBorderRadius: 4,
          });
        }
      } else if (node.type === 'characterCreation') {
        result.push({
          id: `${node.id}-next-${node.next}`,
          source: node.id,
          target: node.next,
          label: 'after creation',
          style: { strokeWidth: 2, strokeDasharray: '5,5' },
          labelStyle: { fontSize: 11, fill: 'var(--color-text-dim)', fontStyle: 'italic' },
          labelBgStyle: { fill: 'var(--color-bg)', fillOpacity: 0.9 },
          labelBgPadding: [6, 3] as [number, number],
          labelBgBorderRadius: 4,
        });
      }
    }
    return result;
  }, [story]);

  // Handle node selection
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode]
  );

  // Handle clicking on empty canvas
  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
  }, [onSelectNode]);

  // Handle edge creation via drag
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && onConnect) {
        onConnect(connection.source, connection.target);
      }
    },
    [onConnect]
  );

  return (
    <div className="app-canvas">
      <ReactFlow
        nodes={nodes as any}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodesChange={handleNodesChange}
        onConnect={handleConnect}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background
          variant={showGrid ? BackgroundVariant.Lines : BackgroundVariant.Dots}
          gap={20}
          size={showGrid ? 0.5 : 1}
          color="var(--color-border)"
        />
        <Controls />
      </ReactFlow>
    </div>
  );
}
