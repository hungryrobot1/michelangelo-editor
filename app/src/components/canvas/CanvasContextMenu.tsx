/**
 * CanvasContextMenu — Right-click context menu for the story canvas.
 *
 * Two variants:
 * - Pane menu (right-click on empty canvas): New node options, paste
 * - Node menu (right-click on a node): Set start, duplicate, copy, delete
 */

/** Preset colors for region comments */
export const REGION_COLORS = [
  { name: 'Blue', value: '#4a7bcc' },
  { name: 'Green', value: '#3d9e6f' },
  { name: 'Purple', value: '#7c5cbf' },
  { name: 'Orange', value: '#c47a2a' },
  { name: 'Red', value: '#c0503a' },
  { name: 'Teal', value: '#2e9aa6' },
] as const;

export interface ContextMenuState {
  /** Screen position to render the menu */
  position: { x: number; y: number };
  /** If set, this is a node context menu for this node ID */
  nodeId?: string;
}

interface CanvasContextMenuProps {
  menu: ContextMenuState;
  isStartNode: boolean;
  hasClipboard: boolean;
  onClose: () => void;
  onAddNode: (type: 'dialogue' | 'characterCreation') => void;
  onDuplicateNode: () => void;
  onCopyNode: () => void;
  onPaste: () => void;
  onDeleteNode: () => void;
  onSetStartNode: () => void;
  onSearch: () => void;
  onAddRegionComment: (color: string) => void;
}

export function CanvasContextMenu({
  menu,
  isStartNode,
  hasClipboard,
  onClose,
  onAddNode,
  onDuplicateNode,
  onCopyNode,
  onPaste,
  onDeleteNode,
  onSetStartNode,
  onSearch,
  onAddRegionComment,
}: CanvasContextMenuProps) {
  const isNodeMenu = !!menu.nodeId;

  return (
    <>
      {/* Invisible backdrop to catch clicks and dismiss the menu */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
        onClick={onClose}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />

      <div
        className="context-menu"
        style={{
          position: 'fixed',
          top: menu.position.y,
          left: menu.position.x,
          zIndex: 1000,
        }}
      >
        {isNodeMenu ? (
          <>
            {!isStartNode && (
              <button className="context-menu-item" onClick={() => { onSetStartNode(); onClose(); }}>
                Set as Start Node
              </button>
            )}
            <button className="context-menu-item" onClick={() => { onDuplicateNode(); onClose(); }}>
              Duplicate Node
            </button>
            <button className="context-menu-item" onClick={() => { onCopyNode(); onClose(); }}>
              Copy Node
            </button>
            {!isStartNode && (
              <>
                <div className="context-menu-separator" />
                <button
                  className="context-menu-item context-menu-item-danger"
                  onClick={() => { onDeleteNode(); onClose(); }}
                >
                  Delete Node
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <button className="context-menu-item" onClick={() => { onAddNode('dialogue'); onClose(); }}>
              New Dialogue Node
            </button>
            <button className="context-menu-item" onClick={() => { onAddNode('characterCreation'); onClose(); }}>
              New Character Creation Node
            </button>
            <div className="context-menu-separator" />
            {hasClipboard && (
              <button className="context-menu-item" onClick={() => { onPaste(); onClose(); }}>
                Paste Node
              </button>
            )}
            <div className="context-menu-label">Region Comment</div>
            <div className="context-menu-colors">
              {REGION_COLORS.map((c) => (
                <button
                  key={c.value}
                  className="context-menu-color-swatch"
                  title={c.name}
                  style={{ backgroundColor: c.value }}
                  onClick={() => { onAddRegionComment(c.value); onClose(); }}
                />
              ))}
            </div>
            <div className="context-menu-separator" />
            <button className="context-menu-item" onClick={() => { onSearch(); onClose(); }}>
              Search Nodes
            </button>
          </>
        )}
      </div>
    </>
  );
}
