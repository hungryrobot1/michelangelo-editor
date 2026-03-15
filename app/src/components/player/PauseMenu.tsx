/**
 * PauseMenu — In-game pause overlay with save/load and theme selection.
 *
 * Saves use localStorage, so they work in dev, exported SPA, and Tauri.
 */

import { useState, useEffect } from 'react';
import type { GameState } from '@engine/types/index.js';
import { useTheme, themes } from '../../lib/themes';

interface PauseMenuProps {
  gameTitle: string;
  gameState: GameState;
  onResume: () => void;
  onLoadState: (state: GameState) => void;
  onRestart: () => void;
  onExit: () => void;
}

interface SaveSlot {
  gameState: GameState;
  savedAt: string;
  nodeName?: string;
}

function getSaveKey(title: string): string {
  return `michelangelo-save-${title.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
}

function getSaves(title: string): SaveSlot[] {
  try {
    const raw = localStorage.getItem(getSaveKey(title));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

function writeSaves(title: string, saves: SaveSlot[]): void {
  try {
    localStorage.setItem(getSaveKey(title), JSON.stringify(saves));
  } catch { /* storage full, ignore */ }
}

export function PauseMenu({
  gameTitle,
  gameState,
  onResume,
  onLoadState,
  onRestart,
  onExit,
}: PauseMenuProps) {
  const { theme, setThemeId } = useTheme();
  const [saves, setSaves] = useState<SaveSlot[]>([]);
  const [notification, setNotification] = useState<string | null>(null);

  useEffect(() => {
    setSaves(getSaves(gameTitle));
  }, [gameTitle]);

  const handleSave = () => {
    const slot: SaveSlot = {
      gameState: structuredClone(gameState),
      savedAt: new Date().toISOString(),
      nodeName: gameState.currentNode,
    };
    const updated = [slot, ...saves.slice(0, 4)]; // Keep max 5 saves
    writeSaves(gameTitle, updated);
    setSaves(updated);
    setNotification('Game saved!');
    setTimeout(() => setNotification(null), 2000);
  };

  const handleLoad = (slot: SaveSlot) => {
    onLoadState(slot.gameState);
  };

  return (
    <div className="pause-overlay" onClick={onResume}>
      <div className="pause-menu" onClick={(e) => e.stopPropagation()}>
        <div className="pause-menu-header">Paused</div>
        <div className="pause-menu-body">
          <button className="pause-menu-btn" onClick={onResume}>
            Resume
          </button>
          <button className="pause-menu-btn" onClick={handleSave}>
            Save Game
          </button>

          {saves.length > 0 && (
            <>
              <div className="pause-menu-divider" />
              <div className="pause-menu-section-title">Load Save</div>
              {saves.map((slot, i) => (
                <button
                  key={i}
                  className="pause-menu-btn"
                  onClick={() => handleLoad(slot)}
                  title={`Node: ${slot.nodeName || 'unknown'}`}
                >
                  <span style={{ flex: 1 }}>
                    Save {saves.length - i}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {formatTime(slot.savedAt)}
                  </span>
                </button>
              ))}
            </>
          )}

          <div className="pause-menu-divider" />
          <div className="pause-menu-section-title">Theme</div>
          <div className="pause-theme-grid">
            {themes.map((t) => (
              <button
                key={t.id}
                className={`pause-theme-swatch ${t.id === theme.id ? 'active' : ''}`}
                onClick={() => setThemeId(t.id)}
              >
                <span
                  className="pause-theme-dot"
                  style={{ background: t.colors['color-accent'] }}
                />
                {t.name}
              </button>
            ))}
          </div>

          <div className="pause-menu-divider" />
          <button className="pause-menu-btn" onClick={onRestart}>
            Restart
          </button>
          <button className="pause-menu-btn danger" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>

      {notification && (
        <div className="save-notification">{notification}</div>
      )}
    </div>
  );
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
