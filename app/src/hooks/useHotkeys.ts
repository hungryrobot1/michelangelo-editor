/**
 * useHotkeys — Global keyboard shortcut handler for the editor.
 *
 * Registers keyboard listeners and dispatches to editor actions.
 * Automatically disables hotkeys when a text input/textarea is focused.
 */

import { useEffect } from 'react';

export interface HotkeyActions {
  onSave: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onEscape: () => void;
  onSearch: () => void;
}

function isTextInput(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

export function useHotkeys(actions: HotkeyActions) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+S — Save (always active, even in text inputs)
      if (mod && e.key === 's') {
        e.preventDefault();
        actions.onSave();
        return;
      }

      // Cmd/Ctrl+K — Search (always active)
      if (mod && e.key === 'k') {
        e.preventDefault();
        actions.onSearch();
        return;
      }

      // Escape — Deselect / close (always active)
      if (e.key === 'Escape') {
        actions.onEscape();
        return;
      }

      // Skip remaining shortcuts when focused on text input
      if (isTextInput(document.activeElement)) return;

      // Cmd/Ctrl+Z — Undo
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        actions.onUndo();
        return;
      }

      // Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y — Redo
      if ((mod && e.shiftKey && e.key === 'z') || (mod && e.key === 'y')) {
        e.preventDefault();
        actions.onRedo();
        return;
      }

      // Delete/Backspace — Delete selected node
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        actions.onDelete();
        return;
      }

      // Cmd/Ctrl+D — Duplicate
      if (mod && e.key === 'd') {
        e.preventDefault();
        actions.onDuplicate();
        return;
      }

      // Cmd/Ctrl+C — Copy
      if (mod && e.key === 'c') {
        e.preventDefault();
        actions.onCopy();
        return;
      }

      // Cmd/Ctrl+V — Paste
      if (mod && e.key === 'v') {
        e.preventDefault();
        actions.onPaste();
        return;
      }
    }

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
