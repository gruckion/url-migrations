import type { ParamShape, RouteContract, Contract } from './types';

export interface ParamIssue {
  param: string;
  reason: string;
}

export interface Validation {
  /** The contract route pattern the path matched, or null when no route matches. */
  route: string | null;
  issues: ParamIssue[];
}

/** Check a URL against a contract: does the route exist, and does each param hold a value it accepts. */
export function validateURL(contract: Contract, input: string | URL): Validation {
  const url = new URL(input);
  const route = matchRoute(contract, url.pathname);
  if (route === null) return { route: null, issues: [] };
  const entry = contract.routes[route];
  if (!entry) return { route, issues: [] };
  return { route, issues: paramIssues(entry, url.searchParams) };
}

function paramIssues(entry: RouteContract, params: URLSearchParams): ParamIssue[] {
  const issues: ParamIssue[] = [];
  for (const key of new Set(params.keys())) {
    const shape = entry.params[key];
    if (!shape) {
      if (!entry.opaque) issues.push({ param: key, reason: 'param is not declared on this route' });
      continue;
    }
    for (const value of params.getAll(key)) {
      if (!acceptsValue(shape, value)) issues.push({ param: key, reason: `"${value}" is not a valid value` });
    }
  }
  return issues;
}

function acceptsValue(shape: ParamShape, value: string): boolean {
  switch (shape.kind) {
    case 'string':
    case 'custom':
    case 'untyped':
      return true;
    case 'integer':
    case 'timestamp':
      return /^-?\d+$/.test(value);
    case 'float':
      return value.trim() !== '' && Number.isFinite(Number(value));
    case 'boolean':
      return value === 'true' || value === 'false';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(value);
    case 'datetime':
      return !Number.isNaN(Date.parse(value));
    case 'json':
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case 'enum':
      return shape.dynamic === true || shape.values.includes(value);
    case 'array': {
      if (value === '') return true;
      const items = shape.separator === 'native' ? [value] : value.split(shape.separator);
      return items.every((item) => acceptsValue(shape.item, item));
    }
    case 'mixed':
      return shape.variants.some((variant) => acceptsValue(variant, value));
  }
}

function segmentsOf(path: string): string[] {
  return path.split('/').filter(Boolean);
}

/** Static segments score highest, so `/orders/new` wins over `/orders/[id]`. */
function matchScore(pattern: string, path: string): number | null {
  const want = segmentsOf(pattern);
  const have = segmentsOf(path);
  let score = 0;
  for (let i = 0; i < want.length; i++) {
    const segment = want[i];
    if (segment === undefined) return null;
    if (segment.startsWith('[[...') && segment.endsWith(']]')) return score;
    if (segment.startsWith('[...') && segment.endsWith(']')) return have.length > i ? score : null;
    if (have[i] === undefined) return null;
    if (segment.startsWith('[') && segment.endsWith(']')) continue;
    if (segment !== have[i]) return null;
    score += 2;
  }
  return have.length === want.length ? score + 1 : null;
}

function matchRoute(contract: Contract, path: string): string | null {
  let best: { route: string; score: number } | null = null;
  for (const route of Object.keys(contract.routes)) {
    const score = matchScore(route, path);
    if (score !== null && (best === null || score > best.score)) best = { route, score };
  }
  return best === null ? null : best.route;
}
