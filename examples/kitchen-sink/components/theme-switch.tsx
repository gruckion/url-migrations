'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

/** Mounted in the root layout, so `theme` belongs to every route. */
export function ThemeSwitch() {
  const [theme, setTheme] = useQueryState('theme', parseAsStringLiteral(['light', 'dark'] as const));
  return <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme ?? 'light'}</button>;
}
