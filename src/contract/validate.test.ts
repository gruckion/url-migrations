import { describe, expect, it } from 'vitest';

import { validateURL } from './validate';
import type { Contract } from './types';

const contract: Contract = {
  version: 1,
  routes: {
    '/orders': {
      params: {
        status: { kind: 'enum', values: ['late', 'open'] },
        page: { kind: 'integer' },
        teams: { kind: 'array', separator: ',', item: { kind: 'enum', values: ['a', 'b'] } },
      },
    },
    '/orders/[id]': { params: { view: { kind: 'string' } } },
    '/orders/new': { params: {} },
    '/docs/[...slug]': { params: {} },
    '/legacy': { params: {}, opaque: true },
  },
};

const at = (path: string) => validateURL(contract, `https://example.com${path}`);

describe('validateURL', () => {
  it('matches static and dynamic routes, preferring the static one', () => {
    expect(at('/orders').route).toBe('/orders');
    expect(at('/orders/42').route).toBe('/orders/[id]');
    expect(at('/orders/new').route).toBe('/orders/new');
    expect(at('/docs/a/b/c').route).toBe('/docs/[...slug]');
  });

  it('returns a null route for a path the contract does not know', () => {
    expect(at('/nope')).toEqual({ route: null, issues: [] });
  });

  it('accepts declared params with valid values', () => {
    expect(at('/orders?status=late&page=2&teams=a,b').issues).toEqual([]);
  });

  it('reports a value outside an enum', () => {
    expect(at('/orders?status=gone').issues).toEqual([expect.objectContaining({ param: 'status' })]);
  });

  it('reports a bad integer and a bad array item', () => {
    expect(at('/orders?page=x').issues).toEqual([expect.objectContaining({ param: 'page' })]);
    expect(at('/orders?teams=a,z').issues).toEqual([expect.objectContaining({ param: 'teams' })]);
  });

  it('reports an undeclared param, except on an opaque route', () => {
    expect(at('/orders?mystery=1').issues).toEqual([expect.objectContaining({ param: 'mystery' })]);
    expect(at('/legacy?mystery=1').issues).toEqual([]);
  });
});
