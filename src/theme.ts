import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'agent-briefs:theme';
const QUERY = '(prefers-color-scheme: dark)';

function systemTheme(): Theme {
  return typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches ? 'dark' : 'light';
}

function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Light or dark. Follows the device until the person picks one with the toggle;
 * from then on their choice is remembered in this browser.
 */
export function useTheme() {
  const [choice, setChoice] = useState<Theme | null>(savedTheme);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia?.(QUERY);
    if (!mq) return;
    const onChange = () => setSystem(systemTheme());
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (choice) root.dataset.theme = choice;
    else delete root.dataset.theme;
  }, [choice]);

  const theme = choice ?? system;
  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setChoice(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, [theme]);

  return { theme, toggle };
}
