/**
 * Theme System
 *
 * Defines color theme presets and provides a React context
 * for switching between them. Themes work by swapping CSS
 * custom properties on the document root.
 */

import { createContext, useContext, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { createElement } from 'react';

export interface ThemeColors {
  'color-bg': string;
  'color-surface': string;
  'color-surface-alt': string;
  'color-border': string;
  'color-border-light': string;
  'color-text': string;
  'color-text-dim': string;
  'color-text-muted': string;
  'color-accent': string;
  'color-accent-hover': string;
  'color-warning': string;
  'color-error': string;
  'color-success': string;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
}

export const themes: Theme[] = [
  {
    id: 'dark',
    name: 'Dark',
    colors: {
      'color-bg': '#121218',
      'color-surface': '#1e1e2e',
      'color-surface-alt': '#2a2a3e',
      'color-border': '#333350',
      'color-border-light': '#44446a',
      'color-text': '#e0e0e0',
      'color-text-dim': '#8888aa',
      'color-text-muted': '#555577',
      'color-accent': '#00b4d8',
      'color-accent-hover': '#48cae4',
      'color-warning': '#e6a817',
      'color-error': '#e63946',
      'color-success': '#2a9d8f',
    },
  },
  {
    id: 'light',
    name: 'Light',
    colors: {
      'color-bg': '#f0f0f4',
      'color-surface': '#ffffff',
      'color-surface-alt': '#e8e8ee',
      'color-border': '#d0d0da',
      'color-border-light': '#bbbbc8',
      'color-text': '#1a1a2e',
      'color-text-dim': '#555570',
      'color-text-muted': '#8888a0',
      'color-accent': '#0088a8',
      'color-accent-hover': '#00a0c4',
      'color-warning': '#c48800',
      'color-error': '#c0303c',
      'color-success': '#208878',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      'color-bg': '#0a0a12',
      'color-surface': '#141422',
      'color-surface-alt': '#1e1e32',
      'color-border': '#252540',
      'color-border-light': '#353560',
      'color-text': '#d0d0e8',
      'color-text-dim': '#7070a0',
      'color-text-muted': '#454570',
      'color-accent': '#6c8cff',
      'color-accent-hover': '#8ca8ff',
      'color-warning': '#e6a817',
      'color-error': '#ff4060',
      'color-success': '#30c090',
    },
  },
  {
    id: 'warm',
    name: 'Warm',
    colors: {
      'color-bg': '#161210',
      'color-surface': '#242018',
      'color-surface-alt': '#322c20',
      'color-border': '#3e3628',
      'color-border-light': '#554a38',
      'color-text': '#e8e0d0',
      'color-text-dim': '#a09880',
      'color-text-muted': '#706858',
      'color-accent': '#e6a030',
      'color-accent-hover': '#f0b848',
      'color-warning': '#e6a817',
      'color-error': '#d04030',
      'color-success': '#60a060',
    },
  },
];

const STORAGE_KEY = 'michelangelo-theme';

function getStoredThemeId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'dark';
  } catch {
    return 'dark';
  }
}

export function getThemeById(id: string): Theme {
  return themes.find((t) => t.id === id) ?? themes[0]!;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

// ── Context ──

interface ThemeContextValue {
  theme: Theme;
  setThemeId: (id: string) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: themes[0]!,
  setThemeId: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getThemeById(getStoredThemeId()));

  const setThemeId = useCallback((id: string) => {
    const t = getThemeById(id);
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch { /* ignore */ }
  }, []);

  // Apply on mount
  useEffect(() => {
    applyTheme(theme);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createElement(ThemeContext.Provider, { value: { theme, setThemeId } }, children);
}
