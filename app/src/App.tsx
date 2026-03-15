/**
 * App — Root component with mode routing.
 *
 * Manages app-level state (menu vs editor vs player)
 * and renders the appropriate view.
 */

import { useReducer, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { appModeReducer, getInitialAppMode } from '@engine/engine/appMode.js';
import type { Story, StoryNode } from '@engine/types/index.js';
import {
  loadGameFromServer,
  discoverGames,
  createProjectOnServer,
  saveStoryToServer,
  exportGame,
  deleteProjectOnServer,
  duplicateProjectOnServer,
  importFromJson,
  importFromFolder,
  downloadStoryAsJson,
  type GameInfo,
  type ExportFormat,
} from './lib/engine';
import { useStoryEditor } from './hooks/useStoryEditor';
import { useHotkeys } from './hooks/useHotkeys';
import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { Inspector } from './components/layout/Inspector';
import { StoryCanvas, type ContextMenuEvent } from './components/canvas/StoryCanvas';
import { CanvasContextMenu, type ContextMenuState } from './components/canvas/CanvasContextMenu';
import { SearchPalette } from './components/layout/SearchPalette';
import { PlayerScreen } from './components/player/PlayerScreen';

export function App() {
  const [appMode, dispatch] = useReducer(appModeReducer, getInitialAppMode());
  const [games, setGames] = useState<GameInfo[]>([]);
  const [loadedStory, setLoadedStory] = useState<Story | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeGameId, setActiveGameId] = useState<string | null>(null);
  const [testPlayStory, setTestPlayStory] = useState<Story | null>(null);
  const [testPlayOptions, setTestPlayOptions] = useState<{ startFromNodeId?: string; debugMode?: boolean } | undefined>(undefined);

  // Discover games on mount
  const refreshGames = useCallback(async () => {
    try {
      const infos = await discoverGames();
      setGames(infos);
    } catch {
      setGames([]);
    }
  }, []);

  useEffect(() => {
    refreshGames();
  }, [refreshGames]);

  // Load a game when entering editor mode
  const openEditor = useCallback(async (gameId: string, gamePath: string) => {
    try {
      setLoadError(null);
      const story = await loadGameFromServer(gamePath);
      setLoadedStory(story);
      setActiveGameId(gameId);
      dispatch({ type: 'openEditor', gameId, gamePath });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load game');
    }
  }, []);

  // Create a new project and open it
  const handleProjectCreated = useCallback(async (gameId: string, gamePath: string, story: Story) => {
    setLoadedStory(story);
    setActiveGameId(gameId);
    setLoadError(null);
    dispatch({ type: 'openEditor', gameId, gamePath });
    refreshGames();
  }, [refreshGames]);

  const handleBackToMenu = useCallback(() => {
    dispatch({ type: 'backToMenu' });
    setLoadedStory(null);
    setActiveGameId(null);
    refreshGames();
  }, [refreshGames]);

  switch (appMode.mode) {
    case 'menu':
      return (
        <MenuScreen
          games={games}
          loadError={loadError}
          onOpenEditor={openEditor}
          onProjectCreated={handleProjectCreated}
          onRefresh={refreshGames}
        />
      );

    case 'editor':
      if (!loadedStory || !activeGameId) return <div>Loading...</div>;
      return (
        <ReactFlowProvider>
          <EditorScreen
            story={loadedStory}
            gameId={activeGameId}
            gameTitle={appMode.gameId}
            onBackToMenu={handleBackToMenu}
            onTestPlay={(currentStory, options) => {
              setTestPlayStory(currentStory);
              setTestPlayOptions(options);
              setLoadedStory(currentStory);
              dispatch({ type: 'testPlay' });
            }}
          />
        </ReactFlowProvider>
      );

    case 'player': {
      const storyToPlay = testPlayStory ?? loadedStory;
      if (!storyToPlay) return <div>No story loaded.</div>;
      return (
        <PlayerScreen
          story={storyToPlay}
          engineOptions={testPlayOptions}
          onExit={() => {
            setTestPlayStory(null);
            setTestPlayOptions(undefined);
            if (appMode.returnTo === 'editor') {
              dispatch({ type: 'returnToEditor' });
            } else {
              handleBackToMenu();
            }
          }}
        />
      );
    }

    default:
      return (
        <div className="menu-screen">
          <button className="btn" onClick={handleBackToMenu}>
            Back to Menu
          </button>
        </div>
      );
  }
}

// =============================================================================
// MENU SCREEN
// =============================================================================

function MenuScreen({
  games,
  loadError,
  onOpenEditor,
  onProjectCreated,
  onRefresh,
}: {
  games: GameInfo[];
  loadError: string | null;
  onOpenEditor: (gameId: string, gamePath: string) => void;
  onProjectCreated: (gameId: string, gamePath: string, story: Story) => void;
  onRefresh: () => void;
}) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ game: GameInfo; story: Story } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  // Import handlers
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    try {
      const result = await importFromJson(file);
      onProjectCreated(result.id, result.path, result.story);
      onRefresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
    e.target.value = '';
  };

  const handleImportFolder = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setImportError(null);
    try {
      const result = await importFromFolder(files);
      onProjectCreated(result.id, result.path, result.story);
      onRefresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    }
    e.target.value = '';
  };

  const selectedGame = games.find((g) => g.id === selectedId) ?? null;

  // Load full story data when a project is selected
  useEffect(() => {
    if (!selectedGame) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    loadGameFromServer(selectedGame.path)
      .then((story) => {
        if (!cancelled) setDetail({ game: selectedGame, story });
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });
    return () => { cancelled = true; };
  }, [selectedGame]);

  // Compute stats from loaded story
  const stats = useMemo(() => {
    if (!detail) return null;
    const nodes = Object.values(detail.story.nodes);
    let totalChoices = 0;
    let wordCount = 0;
    let terminalCount = 0;

    for (const node of nodes) {
      if (node.type === 'dialogue') {
        const d = node as any;
        totalChoices += d.choices?.length ?? 0;
        wordCount += (d.text ?? '').split(/\s+/).filter(Boolean).length;
        if ((d.choices?.length ?? 0) === 0) terminalCount++;
      }
    }

    const entityCount =
      Object.keys(detail.story.attributes).length +
      Object.keys(detail.story.resources).length +
      Object.keys(detail.story.items ?? {}).length +
      Object.keys(detail.story.abilities ?? {}).length +
      Object.keys(detail.story.traits ?? {}).length +
      Object.keys(detail.story.companions ?? {}).length;

    return { totalNodes: nodes.length, totalChoices, wordCount, terminalCount, entityCount };
  }, [detail]);

  const handleDelete = async () => {
    if (!selectedGame) return;
    setActionBusy(true);
    try {
      await deleteProjectOnServer(selectedGame.id);
      setSelectedId(null);
      setConfirmDelete(false);
      onRefresh();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleDuplicate = async () => {
    if (!selectedGame) return;
    setActionBusy(true);
    try {
      const result = await duplicateProjectOnServer(
        selectedGame.id,
        `${selectedGame.manifest.title} (Copy)`
      );
      onRefresh();
      setSelectedId(result.id);
    } catch (err) {
      alert(`Duplicate failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionBusy(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!detail) return;
    setActionBusy(true);
    try {
      const newStatus = detail.story.manifest.status === 'published' ? 'draft' : 'published';
      const updatedStory = {
        ...detail.story,
        manifest: { ...detail.story.manifest, status: newStatus as 'draft' | 'published' },
      };
      await saveStoryToServer(detail.game.id, updatedStory);
      setDetail({ game: detail.game, story: updatedStory });
      onRefresh();
    } catch (err) {
      alert(`Status update failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="menu-screen">
      <h1 className="menu-title">MICHELANGELO</h1>
      <p className="menu-subtitle">Interactive Fiction Editor</p>

      {installPrompt && (
        <button
          className="btn primary"
          style={{ marginBottom: 8, fontSize: 13 }}
          onClick={handleInstall}
        >
          Install as App
        </button>
      )}

      {loadError && (
        <div style={{ color: 'var(--color-error)', fontSize: 13 }}>
          Error: {loadError}
        </div>
      )}

      <div className="menu-split">
        {/* ── Left: Project list ── */}
        <div className="menu-list-panel">
          <button
            className="btn primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            onClick={() => setShowNewProject(true)}
          >
            + New Project
          </button>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload JSON
            </button>
            <button
              className="btn"
              style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
              onClick={() => folderInputRef.current?.click()}
            >
              Upload Folder
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is a non-standard attribute
            webkitdirectory=""
            style={{ display: 'none' }}
            onChange={handleImportFolder}
          />

          {importError && (
            <div style={{ color: 'var(--color-error)', fontSize: 12, padding: '4px 0' }}>
              {importError}
            </div>
          )}

          <div className="menu-list-scroll">
            {games.length === 0 && (
              <div style={{ color: 'var(--color-text-dim)', textAlign: 'center', marginTop: 8, fontSize: 13 }}>
                No projects yet. Create one to get started!
              </div>
            )}
            {games.map((game) => (
              <button
                key={game.id}
                className={`menu-game-card ${game.id === selectedId ? 'selected' : ''}`}
                onClick={() => setSelectedId(game.id === selectedId ? null : game.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="menu-game-title" style={{ flex: 1 }}>{game.manifest.title}</div>
                  <span
                    className="story-node-badge"
                    style={{
                      background: game.manifest.status === 'published'
                        ? 'var(--color-success)'
                        : 'var(--color-surface-alt)',
                      color: game.manifest.status === 'published'
                        ? '#fff'
                        : 'var(--color-text-dim)',
                      border: game.manifest.status !== 'published'
                        ? '1px solid var(--color-border)'
                        : 'none',
                    }}
                  >
                    {game.manifest.status ?? 'draft'}
                  </span>
                </div>
                {game.manifest.description && (
                  <div className="menu-game-desc">{game.manifest.description}</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: Detail panel ── */}
        <div className="menu-detail-panel">
          {!selectedGame && (
            <div className="menu-detail-empty">
              Select a project to view details
            </div>
          )}

          {selectedGame && loadingDetail && (
            <div className="menu-detail-empty">Loading...</div>
          )}

          {selectedGame && detail && !loadingDetail && (
            <>
              <div className="menu-detail-header">
                <h2 className="menu-detail-title">{detail.story.manifest.title}</h2>
                <span
                  className="story-node-badge"
                  style={{
                    background: detail.story.manifest.status === 'published'
                      ? 'var(--color-success)'
                      : 'var(--color-surface-alt)',
                    color: detail.story.manifest.status === 'published'
                      ? '#fff'
                      : 'var(--color-text-dim)',
                    border: detail.story.manifest.status !== 'published'
                      ? '1px solid var(--color-border)'
                      : 'none',
                  }}
                >
                  {detail.story.manifest.status ?? 'draft'}
                </span>
              </div>

              {detail.story.manifest.author && (
                <div className="menu-detail-meta">by {detail.story.manifest.author}</div>
              )}
              {detail.story.manifest.description && (
                <div className="menu-detail-desc">{detail.story.manifest.description}</div>
              )}
              {detail.story.manifest.version && (
                <div className="menu-detail-meta">v{detail.story.manifest.version}</div>
              )}

              {/* Statistics */}
              {stats && (
                <div className="menu-detail-stats">
                  <div className="menu-detail-stats-title">Statistics</div>
                  <div className="menu-detail-stats-grid">
                    <div className="menu-detail-stat">
                      <span className="menu-detail-stat-value">{stats.totalNodes}</span>
                      <span className="menu-detail-stat-label">Nodes</span>
                    </div>
                    <div className="menu-detail-stat">
                      <span className="menu-detail-stat-value">{stats.totalChoices}</span>
                      <span className="menu-detail-stat-label">Choices</span>
                    </div>
                    <div className="menu-detail-stat">
                      <span className="menu-detail-stat-value">{stats.terminalCount}</span>
                      <span className="menu-detail-stat-label">Endings</span>
                    </div>
                    <div className="menu-detail-stat">
                      <span className="menu-detail-stat-value">{stats.wordCount.toLocaleString()}</span>
                      <span className="menu-detail-stat-label">Words</span>
                    </div>
                    <div className="menu-detail-stat">
                      <span className="menu-detail-stat-value">{stats.entityCount}</span>
                      <span className="menu-detail-stat-label">Entities</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="menu-detail-actions">
                <button
                  className="btn primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => onOpenEditor(selectedGame.id, selectedGame.path)}
                >
                  Open in Editor
                </button>
                <button
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleDuplicate}
                  disabled={actionBusy}
                >
                  Duplicate
                </button>
                <button
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => downloadStoryAsJson(detail.story)}
                >
                  Download Project
                </button>
                <button
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={handleTogglePublish}
                  disabled={actionBusy}
                >
                  {detail.story.manifest.status === 'published' ? 'Revert to Draft' : 'Publish'}
                </button>

                {!confirmDelete ? (
                  <button
                    className="btn danger"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => setConfirmDelete(true)}
                    disabled={actionBusy}
                  >
                    Delete Project
                  </button>
                ) : (
                  <div className="menu-detail-confirm-delete">
                    <span style={{ fontSize: 12, color: 'var(--color-error)' }}>Are you sure? This cannot be undone.</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn danger"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={handleDelete}
                        disabled={actionBusy}
                      >
                        {actionBusy ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        className="btn"
                        style={{ flex: 1, justifyContent: 'center' }}
                        onClick={() => setConfirmDelete(false)}
                        disabled={actionBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showNewProject && (
        <NewProjectDialog
          onClose={() => setShowNewProject(false)}
          onCreated={(id, path, story) => {
            setShowNewProject(false);
            onProjectCreated(id, path, story);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// NEW PROJECT DIALOG
// =============================================================================

function NewProjectDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string, path: string, story: Story) => void;
}) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result = await createProjectOnServer({
        title: title.trim(),
        author: author.trim() || undefined,
        description: description.trim() || undefined,
      });
      onCreated(result.id, result.path, result.story);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
      setCreating(false);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">New Project</div>
        <div className="dialog-body">
          {error && (
            <div style={{ color: 'var(--color-error)', fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <div className="field">
            <label className="field-label">Title *</label>
            <input
              className="field-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Adventure"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="field">
            <label className="field-label">Author</label>
            <input
              className="field-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="field">
            <label className="field-label">Description</label>
            <textarea
              className="field-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your story..."
              rows={3}
            />
          </div>
        </div>
        <div className="dialog-actions">
          <button className="btn" onClick={onClose} disabled={creating}>
            Cancel
          </button>
          <button className="btn primary" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// EDITOR SCREEN
// =============================================================================

function EditorScreen({
  story: initialStory,
  gameId,
  gameTitle,
  onBackToMenu,
  onTestPlay,
}: {
  story: Story;
  gameId: string;
  gameTitle: string;
  onBackToMenu: () => void;
  onTestPlay: (currentStory: Story, options?: { startFromNodeId?: string; debugMode?: boolean }) => void;
}) {
  const editor = useStoryEditor(initialStory);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const getViewportCenterRef = useRef<() => { x: number; y: number }>(() => ({ x: 200, y: 200 }));
  const panToNodeRef = useRef<(nodeId: string) => void>(() => {});

  // Context menu state
  const [contextMenu, setContextMenu] = useState<(ContextMenuState & { flowPosition: { x: number; y: number } }) | null>(null);

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<StoryNode | null>(null);

  // Search palette
  const [showSearch, setShowSearch] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await saveStoryToServer(gameId, editor.story);
      editor.markClean();
    } catch (err) {
      console.error('Save failed:', err);
      alert(`Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [gameId, editor]);

  const handleValidate = useCallback(() => {
    const result = editor.validation;
    if (result.valid) {
      console.log('Validation passed!');
    } else {
      console.log('Validation issues:', result.issues);
    }
  }, [editor]);

  const handleUpdateNodePosition = useCallback(
    (nodeId: string, position: { x: number; y: number }) => {
      editor.updateNode(nodeId, { editorPosition: position });
    },
    [editor]
  );

  const handleExport = useCallback(async (format: ExportFormat, outputPath?: string) => {
    setExporting(true);
    try {
      const result = await exportGame(gameId, editor.story, format, outputPath);
      alert(`Export complete!\nOutput: ${result.outputPath}`);
    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(false);
    }
  }, [gameId, editor]);

  const handleConnect = useCallback((sourceId: string, targetId: string) => {
    editor.addChoice(sourceId, { text: '', next: targetId });
  }, [editor]);

  const handleAddNode = useCallback((nodeType: 'dialogue' | 'characterCreation', position?: { x: number; y: number }) => {
    const pos = position ?? getViewportCenterRef.current();

    let result;
    if (nodeType === 'characterCreation') {
      result = editor.addNode({
        type: 'characterCreation',
        next: editor.story.manifest.startNode,
        editorPosition: pos,
      });
    } else {
      result = editor.addNode({
        type: 'dialogue',
        text: '',
        choices: [],
        editorPosition: pos,
      });
    }

    if (result.success) {
      const newNodes = Object.keys(result.story.nodes);
      const oldNodes = new Set(Object.keys(editor.story.nodes));
      const newNodeId = newNodes.find((id) => !oldNodes.has(id));
      if (newNodeId) editor.selectNode(newNodeId);
    }
  }, [editor]);

  // ── Copy / Paste ──

  const handleCopyNode = useCallback(() => {
    if (!editor.selectedNodeId) return;
    const node = editor.story.nodes[editor.selectedNodeId];
    if (node) setClipboard(node);
  }, [editor.selectedNodeId, editor.story.nodes]);

  const handlePasteNode = useCallback((position?: { x: number; y: number }) => {
    if (!clipboard) return;
    const pos = position ?? getViewportCenterRef.current();
    // Duplicate the clipboard node at the target position
    const result = editor.duplicateNode(clipboard.id);
    if (result.success) {
      // Find the new node and move it to the paste position
      const newNodes = Object.keys(result.story.nodes);
      const oldNodes = new Set(Object.keys(editor.story.nodes));
      const newNodeId = newNodes.find((id) => !oldNodes.has(id));
      if (newNodeId) {
        editor.updateNode(newNodeId, { editorPosition: pos });
        editor.selectNode(newNodeId);
      }
    }
  }, [clipboard, editor]);

  const handleDeleteSelectedNode = useCallback(() => {
    if (!editor.selectedNodeId) return;
    // Check if it's a region comment
    const isRegion = (editor.story.regionComments ?? []).some((c) => c.id === editor.selectedNodeId);
    if (isRegion) {
      editor.removeRegionComment(editor.selectedNodeId);
      return;
    }
    if (editor.selectedNodeId === editor.story.manifest.startNode) return;
    editor.deleteNode(editor.selectedNodeId, true);
  }, [editor]);

  const handleDuplicateSelectedNode = useCallback(() => {
    if (!editor.selectedNodeId) return;
    // Check if it's a region comment
    const region = (editor.story.regionComments ?? []).find((c) => c.id === editor.selectedNodeId);
    if (region) {
      const oldIds = new Set((editor.story.regionComments ?? []).map((c) => c.id));
      const result = editor.addRegionComment({
        label: region.label,
        position: { x: region.position.x + 40, y: region.position.y + 40 },
        size: { ...region.size },
        color: region.color,
        comment: region.comment,
      });
      if (result.success) {
        const newId = (result.story.regionComments ?? []).find((c) => !oldIds.has(c.id))?.id;
        if (newId) editor.selectNode(newId);
      }
      return;
    }
    const result = editor.duplicateNode(editor.selectedNodeId);
    if (result.success) {
      const newNodes = Object.keys(result.story.nodes);
      const oldNodes = new Set(Object.keys(editor.story.nodes));
      const newNodeId = newNodes.find((id) => !oldNodes.has(id));
      if (newNodeId) editor.selectNode(newNodeId);
    }
  }, [editor]);

  // ── Context Menu ──

  const handleContextMenu = useCallback((event: ContextMenuEvent) => {
    setContextMenu({
      position: event.position,
      flowPosition: event.flowPosition,
      nodeId: event.nodeId,
    });
  }, []);

  // ── Search navigation ──

  const handleSearchSelect = useCallback((nodeId: string) => {
    editor.selectNode(nodeId);
    panToNodeRef.current(nodeId);
    setShowSearch(false);
  }, [editor]);

  // ── Hotkeys ──

  const hotkeyActions = useMemo(() => ({
    onSave: () => { handleSave(); },
    onUndo: () => { editor.undo(); },
    onRedo: () => { editor.redo(); },
    onDelete: handleDeleteSelectedNode,
    onDuplicate: handleDuplicateSelectedNode,
    onCopy: handleCopyNode,
    onPaste: () => handlePasteNode(),
    onEscape: () => {
      if (showSearch) { setShowSearch(false); return; }
      if (contextMenu) { setContextMenu(null); return; }
      editor.selectNode(null);
    },
    onSearch: () => setShowSearch(true),
  }), [handleSave, editor, handleDeleteSelectedNode, handleDuplicateSelectedNode, handleCopyNode, handlePasteNode, showSearch, contextMenu]);

  useHotkeys(hotkeyActions);

  return (
    <div className="app-layout">
      <Toolbar
        title={editor.story.manifest.title || gameTitle}
        isDirty={editor.isDirty}
        isSaving={saving}
        validation={editor.validation}
        sidebarOpen={sidebarOpen}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        showGrid={showGrid}
        onSave={handleSave}
        onAddNode={handleAddNode}
        onAddRegionComment={() => {
          const pos = getViewportCenterRef.current();
          editor.addRegionComment({
            label: 'Region',
            position: pos,
            size: { width: 400, height: 250 },
          });
        }}
        onValidate={handleValidate}
        onTestPlay={() => onTestPlay(editor.story)}
        isExporting={exporting}
        onExport={handleExport}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onToggleGrid={() => setShowGrid(!showGrid)}
        onBackToMenu={onBackToMenu}
      />

      <div className="app-main">
        <Sidebar
          story={editor.story}
          isOpen={sidebarOpen}
          selectedNodeId={editor.selectedNodeId}
          onAddEntity={editor.addEntity}
          onUpdateEntity={editor.updateEntity}
          onRemoveEntity={editor.removeEntity}
          onSelectNode={handleSearchSelect}
          onUpdateManifest={(updates) => editor.updateManifest(updates)}
          onUpdateCharacterCreation={(updates) => editor.updateCharacterCreation(updates)}
        />

        <StoryCanvas
          story={editor.story}
          selectedNodeId={editor.selectedNodeId}
          showGrid={showGrid}
          onSelectNode={editor.selectNode}
          onUpdateNodePosition={handleUpdateNodePosition}
          onConnect={handleConnect}
          onRegisterGetViewportCenter={(fn) => { getViewportCenterRef.current = fn; }}
          onRegisterPanToNode={(fn) => { panToNodeRef.current = fn; }}
          onContextMenu={handleContextMenu}
          onUpdateRegionComment={(id, updates) => editor.updateRegionComment(id, updates)}
          onDeleteRegionComment={(id) => editor.removeRegionComment(id)}
        />

        <Inspector
          story={editor.story}
          selectedNodeId={editor.selectedNodeId}
          onUpdateNode={editor.updateNode}
          onAddChoice={editor.addChoice}
          onUpdateChoice={editor.updateChoice}
          onRemoveChoice={editor.removeChoice}
          onReorderChoices={editor.reorderChoices}
          onDeleteNode={(nodeId) => editor.deleteNode(nodeId, true)}
          onSetStartNode={editor.setStartNode}
          onPlayFromNode={(nodeId) => onTestPlay(editor.story, { startFromNodeId: nodeId, debugMode: true })}
          onUpdateRegionComment={(id, updates) => editor.updateRegionComment(id, updates)}
          onDeleteRegionComment={(id) => editor.removeRegionComment(id)}
        />
      </div>

      {/* Context menu */}
      {contextMenu && (
        <CanvasContextMenu
          menu={contextMenu}
          isStartNode={contextMenu.nodeId === editor.story.manifest.startNode}
          hasClipboard={!!clipboard}
          onClose={() => setContextMenu(null)}
          onAddNode={(type) => handleAddNode(type, contextMenu.flowPosition)}
          onDuplicateNode={handleDuplicateSelectedNode}
          onCopyNode={handleCopyNode}
          onPaste={() => handlePasteNode(contextMenu.flowPosition)}
          onDeleteNode={handleDeleteSelectedNode}
          onSetStartNode={() => {
            if (contextMenu.nodeId) editor.setStartNode(contextMenu.nodeId);
          }}
          onSearch={() => setShowSearch(true)}
          onAddRegionComment={(color) => {
            editor.addRegionComment({
              label: 'Region',
              position: contextMenu.flowPosition ?? { x: 0, y: 0 },
              size: { width: 400, height: 250 },
              color,
            });
          }}
        />
      )}

      {/* Search palette */}
      {showSearch && (
        <SearchPalette
          story={editor.story}
          onSelect={handleSearchSelect}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
