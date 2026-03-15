/**
 * App Mode State Machine
 *
 * A pure reducer for application-level navigation.
 * Both the CLI (via a loop) and React (via useReducer) consume this.
 *
 * States:
 *   menu        → top-level menu
 *   gameSelect  → browsing available games
 *   newProject  → creating a new project
 *   editor      → editing a game
 *   player      → playing a game (optionally with returnTo for test-play)
 */

// =============================================================================
// STATE TYPES
// =============================================================================

export type AppMode =
  | { mode: 'menu' }
  | { mode: 'gameSelect'; gamesDir: string }
  | { mode: 'newProject' }
  | { mode: 'editor'; gameId: string; gamePath: string }
  | { mode: 'player'; gameId: string; gamePath: string; returnTo?: 'editor' };

// =============================================================================
// ACTION TYPES
// =============================================================================

export type AppAction =
  /** Navigate to game browser */
  | { type: 'browseGames'; gamesDir: string }
  /** Open a game in the editor */
  | { type: 'openEditor'; gameId: string; gamePath: string }
  /** Open a game in the player */
  | { type: 'openPlayer'; gameId: string; gamePath: string }
  /** Start creating a new project */
  | { type: 'newProject' }
  /** New project created — open it in editor */
  | { type: 'projectCreated'; gameId: string; gamePath: string }
  /** Test-play from editor (sets returnTo: 'editor') */
  | { type: 'testPlay' }
  /** Return to editor from test-play */
  | { type: 'returnToEditor' }
  /** Go back to the main menu */
  | { type: 'backToMenu' };

// =============================================================================
// REDUCER
// =============================================================================

/**
 * Reduces an AppMode + AppAction into a new AppMode.
 * Invalid transitions return the current state unchanged.
 */
export function appModeReducer(state: AppMode, action: AppAction): AppMode {
  switch (action.type) {
    case 'browseGames':
      if (state.mode === 'menu') {
        return { mode: 'gameSelect', gamesDir: action.gamesDir };
      }
      return state;

    case 'openEditor':
      if (state.mode === 'gameSelect' || state.mode === 'menu') {
        return { mode: 'editor', gameId: action.gameId, gamePath: action.gamePath };
      }
      return state;

    case 'openPlayer':
      if (state.mode === 'gameSelect' || state.mode === 'menu') {
        return { mode: 'player', gameId: action.gameId, gamePath: action.gamePath };
      }
      return state;

    case 'newProject':
      if (state.mode === 'menu' || state.mode === 'gameSelect') {
        return { mode: 'newProject' };
      }
      return state;

    case 'projectCreated':
      if (state.mode === 'newProject') {
        return { mode: 'editor', gameId: action.gameId, gamePath: action.gamePath };
      }
      return state;

    case 'testPlay':
      if (state.mode === 'editor') {
        return {
          mode: 'player',
          gameId: state.gameId,
          gamePath: state.gamePath,
          returnTo: 'editor',
        };
      }
      return state;

    case 'returnToEditor':
      if (state.mode === 'player' && state.returnTo === 'editor') {
        return {
          mode: 'editor',
          gameId: state.gameId,
          gamePath: state.gamePath,
        };
      }
      return state;

    case 'backToMenu':
      return { mode: 'menu' };

    default:
      return state;
  }
}

/**
 * Returns the initial app mode.
 */
export function getInitialAppMode(): AppMode {
  return { mode: 'menu' };
}
