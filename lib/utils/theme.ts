/**
 * Theme management utilities
 */

const THEME_STORAGE_KEY = 'llm_comparison_theme';

export type Theme = 'light' | 'dark' | 'system';

/**
 * Get current theme preference
 */
export function getTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'system';
  }
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  return stored || 'system';
}

/**
 * Set theme preference
 */
export function setTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}

/**
 * Apply theme to document
 */
export function applyTheme(theme: Theme): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

/**
 * Initialize theme on page load
 */
export function initTheme(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  const theme = getTheme();
  applyTheme(theme);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (getTheme() === 'system') {
      document.documentElement.classList.toggle('dark', e.matches);
    }
  });
}

/**
 * Toggle between light and dark
 */
export function toggleTheme(): void {
  const current = getTheme();
  const isDark = current === 'dark' || 
    (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  setTheme(isDark ? 'light' : 'dark');
}

