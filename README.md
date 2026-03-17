# Michelangelo

A visual editor for interactive fiction. Build branching narratives with RPG mechanics, then export standalone games that run in a browser or terminal.

**[Try it in your browser](https://hungryrobot1.github.io/michelangelo-editor/)** — no install required.

## What It Does

Michelangelo is a node-based editor for creating text adventures, choice-driven stories, and narrative RPGs. You connect story nodes on a canvas, write dialogue, add game mechanics, and export a playable game.

**Editor features:**
- Visual canvas with drag-and-drop story nodes and edge connections
- Inspector panel for editing node text, choices, conditions, and effects
- Sidebar for managing game entities (attributes, items, abilities, traits, companions)
- Character creation system (point-buy, dice roll, or preset methods)
- Undo/redo, copy/paste, search, keyboard shortcuts
- Validation with real-time error checking
- Test play directly from the editor

**Game mechanics:**
- Attributes and resources (health, strength, mana, etc.)
- Items with categories, stacking, and equipment slots
- Abilities with cooldowns and resource costs
- Traits and companion characters
- Conditional branching (stat checks, item requirements, flag tests)
- Effects on choices (give items, modify stats, set flags)

**Export formats:**
- Standalone web page (single HTML file)
- Terminal app (plays in any command line)
- JSON project file (for backup and sharing)

## Running Locally

```bash
# Install dependencies
npm install
cd app && npm install && cd ..

# Start the dev server (editor + API)
cd app && npx vite

# Build the static site
cd app && npx vite build
```

The dev server provides a file-based API for saving projects to disk. The static build uses IndexedDB for browser-local storage — no server needed.

## Project Structure

```
src/                    Core engine (pure TypeScript, no browser deps)
  engine/               Editor logic, validation, conditions, effects
  types/                Type definitions for the entire data model
app/                    Web UI (React + Vite)
  src/components/       Canvas, inspector, sidebar, toolbar, player
  src/hooks/            React hooks (story editor state, hotkeys)
  src/lib/              Browser adapter (engine bridge, IndexedDB storage)
docs/                   GitHub Pages site (landing page + built editor)
```

The engine in `src/` is a pure TypeScript library with no browser or Node.js dependencies in its core logic. The web app in `app/` wraps it with a React UI. The same engine types power both the visual editor and the CLI player.

## License

MIT
