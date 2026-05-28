export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'sentryvision-theme';

function getSystemTheme(): 'dark' {
  return 'dark';
}

export function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'dark';
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
}

export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolved);
  root.setAttribute('data-theme', resolved);
}

export function initTheme(): void {
  const theme = getStoredTheme();
  applyTheme(theme);
}

export function watchSystemPreference(callback: () => void): () => void {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => callback();
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}
