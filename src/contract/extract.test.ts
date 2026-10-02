import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { extractContract } from './extract';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fixtures/app-router');

describe('extractContract', () => {
  const result = extractContract({ root });

  it('maps pages to routes, dropping groups and parallel slots', () => {
    expect(Object.keys(result.contract.routes)).toEqual(['/orders', '/orders/[id]', '/plain', '/schedule', '/search']);
  });

  it('follows imports from the page and its layouts', () => {
    const orders = result.contract.routes['/orders'];
    expect(Object.keys(orders?.params ?? {})).toEqual(['from', 'p', 'ref', 'status', 'tab', 'team_ids']);
  });

  it('reads parsers, enum values through spreads, and array separators', () => {
    const params = result.contract.routes['/orders']?.params;
    expect(params?.status).toEqual({ kind: 'enum', values: ['open', 'paid', 'void'] });
    expect(params?.team_ids).toEqual({ kind: 'array', item: { kind: 'string' }, separator: ',' });
    expect(params?.tab).toEqual({ kind: 'string' });
  });

  it('uses the URL key from urlKeys, not the schema key', () => {
    const params = result.contract.routes['/orders']?.params;
    expect(params?.p).toEqual({ kind: 'integer' });
    expect(params).not.toHaveProperty('page');
  });

  it('names custom parsers after the exported binding', () => {
    expect(result.contract.routes['/orders']?.params.from).toEqual({ kind: 'custom', name: 'parseAsYmd' });
  });

  it('lists literal useSearchParams reads as untyped', () => {
    expect(result.contract.routes['/orders']?.params.ref).toEqual({ kind: 'untyped' });
  });

  it('reads typed page searchParams props', () => {
    const params = result.contract.routes['/orders/[id]']?.params;
    expect(params?.view).toEqual({ kind: 'enum', values: ['compact', 'full'] });
    expect(params?.q).toEqual({ kind: 'string' });
  });

  it('flags a route that reads search params in a way a scan cannot list', () => {
    expect(result.contract.routes['/search']?.opaque).toBe(true);
    expect(result.contract.routes['/orders']?.opaque).toBeUndefined();
    expect(result.warnings.some((w) => w.file.endsWith('opaque-reader.tsx'))).toBe(true);
  });

  it('counts a provider only where something renders it, not where something imports its context hook', () => {
    expect(Object.keys(result.contract.routes['/schedule']?.params ?? {})).toContain('lane');
    expect(result.contract.routes['/plain']?.params).toEqual({ tab: { kind: 'string' } });
    expect(result.contract.routes['/orders']?.params).not.toHaveProperty('lane');
  });
});
