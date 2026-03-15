/**
 * Toolbar — Top bar with editor actions.
 */

import { useState, useRef, useEffect } from 'react';
import type { NodeType } from '@engine/types/index.js';
import type { ValidationResult } from '@engine/engine/validation.js';
import { useTheme, themes } from '../../lib/themes';

interface ToolbarProps {
  title: string;
  isDirty: boolean;
  isSaving?: boolean;
  validation: ValidationResult;
  sidebarOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  showGrid: boolean;
  onSave: () => void;
  onAddNode: (type: NodeType) => void;
  onAddRegionComment?: () => void;
  onValidate: () => void;
  onTestPlay: () => void;
  isExporting?: boolean;
  onExport: (format: 'folder' | 'single-file' | 'desktop' | 'json' | 'cli', outputPath?: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleSidebar: () => void;
  onToggleGrid: () => void;
  onBackToMenu: () => void;
}

export function Toolbar({
  title,
  isDirty,
  isSaving,
  validation,
  sidebarOpen,
  canUndo,
  canRedo,
  showGrid,
  onSave,
  onAddNode,
  onAddRegionComment,
  onValidate,
  onTestPlay,
  isExporting,
  onExport,
  onUndo,
  onRedo,
  onToggleSidebar,
  onToggleGrid,
  onBackToMenu,
}: ToolbarProps) {
  const statusClass = validation.errors.length > 0
    ? 'error'
    : validation.warnings.length > 0
      ? 'warning'
      : 'valid';

  const statusText = validation.errors.length > 0
    ? `${validation.errors.length} error${validation.errors.length > 1 ? 's' : ''}`
    : validation.warnings.length > 0
      ? `${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`
      : 'Valid';

  return (
    <div className="toolbar">
      <button className="btn icon-only" onClick={onBackToMenu} title="Back to menu">
        &larr;
      </button>

      <span className="toolbar-title">
        {title}{isDirty ? ' *' : ''}
      </span>

      {/* Sidebar toggle — near left side, close to sidebar */}
      <button
        className={`btn icon-only ${sidebarOpen ? 'active' : ''}`}
        onClick={onToggleSidebar}
        title="Toggle sidebar"
      >
        Sidebar
      </button>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button className="btn" onClick={onSave} disabled={isSaving} title="Save project">
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn" onClick={onUndo} disabled={!canUndo} title="Undo">
          Undo
        </button>
        <button className="btn" onClick={onRedo} disabled={!canRedo} title="Redo">
          Redo
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <AddNodeDropdown onAddNode={onAddNode} onAddRegionComment={onAddRegionComment} />
        <button className="btn" onClick={onValidate} title="Run validation">
          Validate
        </button>
        <button className="btn primary" onClick={onTestPlay} title="Test play from start">
          Test Play
        </button>
        <ExportDropdown onExport={onExport} isExporting={isExporting} />
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button
          className={`btn icon-only ${showGrid ? 'active' : ''}`}
          onClick={onToggleGrid}
          title={showGrid ? 'Switch to dots' : 'Switch to grid'}
        >
          {showGrid ? '##' : '::'}
        </button>
        <ThemeDropdown />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-status">
        <span className={`toolbar-status-dot ${statusClass}`} />
        {statusText}
      </div>
    </div>
  );
}

function ThemeDropdown() {
  const { theme, setThemeId } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="theme-selector">
      <button
        className="btn icon-only"
        onClick={() => setOpen(!open)}
        title="Change theme"
      >
        <span
          className="pause-theme-dot"
          style={{ background: theme.colors['color-accent'], width: 12, height: 12 }}
        />
      </button>
      {open && (
        <div className="theme-dropdown">
          {themes.map((t) => (
            <button
              key={t.id}
              className={`theme-dropdown-item ${t.id === theme.id ? 'active' : ''}`}
              onClick={() => { setThemeId(t.id); setOpen(false); }}
            >
              <span
                className="pause-theme-dot"
                style={{ background: t.colors['color-accent'], width: 12, height: 12 }}
              />
              {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const EXPORT_PATH_KEY = 'michelangelo-export-path';

function ExportDropdown({ onExport, isExporting }: { onExport: (format: 'folder' | 'single-file' | 'desktop' | 'json' | 'cli', outputPath?: string) => void; isExporting?: boolean }) {
  const [open, setOpen] = useState(false);
  const [exportPath, setExportPath] = useState(() => localStorage.getItem(EXPORT_PATH_KEY) ?? '');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleExport = (format: 'folder' | 'single-file' | 'desktop' | 'json' | 'cli') => {
    const trimmed = exportPath.trim();
    if (trimmed) {
      localStorage.setItem(EXPORT_PATH_KEY, trimmed);
    } else {
      localStorage.removeItem(EXPORT_PATH_KEY);
    }
    onExport(format, trimmed || undefined);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="btn"
        onClick={() => setOpen(!open)}
        disabled={isExporting}
        title="Export game as standalone SPA"
      >
        {isExporting ? 'Exporting...' : 'Export ▾'}
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          minWidth: 280,
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <div style={{ padding: '8px 10px 4px' }}>
            <label style={{ fontSize: 11, color: 'var(--color-text-dim)', display: 'block', marginBottom: 4 }}>
              Output path
            </label>
            <input
              className="field-input"
              value={exportPath}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="Default (exports/)"
              style={{ fontSize: 12, padding: '4px 6px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '6px 0 2px' }} />
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => handleExport('folder')}
          >
            Export as Folder
          </button>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => handleExport('single-file')}
          >
            Export as Single HTML
          </button>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => handleExport('json')}
          >
            Export as JSON
          </button>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => handleExport('cli')}
          >
            Export as CLI Player
          </button>
          <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => handleExport('desktop')}
          >
            Export as Desktop App
          </button>
        </div>
      )}
    </div>
  );
}

function AddNodeDropdown({ onAddNode, onAddRegionComment }: { onAddNode: (type: NodeType) => void; onAddRegionComment?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn" onClick={() => setOpen(!open)} title="Add a new node">
        + Node ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 4,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          minWidth: 180,
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => { onAddNode('dialogue'); setOpen(false); }}
          >
            Dialogue Node
          </button>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
            onClick={() => { onAddNode('characterCreation'); setOpen(false); }}
          >
            Character Creation Node
          </button>
          {onAddRegionComment && (
            <>
              <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />
              <button
                className="btn"
                style={{ width: '100%', justifyContent: 'flex-start', border: 'none', borderRadius: 0 }}
                onClick={() => { onAddRegionComment(); setOpen(false); }}
              >
                Region Comment
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
