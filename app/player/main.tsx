/**
 * Standalone Player Entry Point
 *
 * This is the entry point for exported games. It reads the story data
 * from a JSON blob embedded in the page (window.__STORY_DATA__) and
 * renders the player UI. No server or editor dependencies.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Story } from '@engine/types/index.js';
import { PlayerScreen } from '../src/components/player/PlayerScreen';
import './player.css';

declare global {
  interface Window {
    __STORY_DATA__?: Story;
  }
}

function StandalonePlayer() {
  const story = window.__STORY_DATA__;

  if (!story) {
    return (
      <div className="player-screen">
        <div className="player-panel" style={{ maxWidth: 500, textAlign: 'center' }}>
          <h2 className="player-heading">Error</h2>
          <p>No story data found. The game file may be corrupted.</p>
        </div>
      </div>
    );
  }

  return (
    <PlayerScreen
      story={story}
      onExit={() => {
        // In standalone mode, restart the game instead of exiting
        window.location.reload();
      }}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StandalonePlayer />
  </StrictMode>
);
