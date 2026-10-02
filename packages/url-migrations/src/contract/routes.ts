import path from 'node:path';

const PAGE_FILE = /^page\.(tsx|ts|jsx|js|mdx)$/;

export function isPageFile(file: string): boolean {
  return PAGE_FILE.test(path.basename(file));
}

/**
 * `app/(shop)/orders/[id]/page.tsx` -> `/orders/[id]`.
 * Returns null for pages that are not directly addressable: parallel route slots and intercepting routes.
 */
export function routeFromPageFile(appDir: string, file: string): string | null {
  const relativeDir = path.relative(appDir, path.dirname(file));
  const segments = relativeDir.split(path.sep).filter(Boolean);
  const kept: string[] = [];
  for (const segment of segments) {
    if (segment.startsWith('@') || segment.startsWith('(.')) return null;
    if (segment.startsWith('(') && segment.endsWith(')')) continue;
    kept.push(segment);
  }
  return `/${kept.join('/')}`;
}

/** Directories from `appDir` down to the page's directory, root first. Layouts in them wrap the page. */
export function ancestorDirs(appDir: string, pageFile: string): string[] {
  const dirs: string[] = [];
  let current = path.dirname(pageFile);
  for (;;) {
    dirs.unshift(current);
    if (current === appDir) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return dirs;
}
