import { describe, expect, it } from 'vitest';

import { createURLMigration } from '../index';
import { checkMigrations } from './check';
import type { Contract } from './types';

const base: Contract = {
  version: 1,
  routes: {
    '/orders': {
      params: { status: { kind: 'enum', values: ['late', 'open'] } },
    },
    '/old': { params: {} },
  },
};

const head: Contract = {
  version: 1,
  routes: {
    '/orders': {
      params: { status: { kind: 'enum', values: ['open'] }, is_late: { kind: 'boolean' } },
    },
    '/new': { params: {} },
  },
};

const migrate = createURLMigration([
  {
    type: 'custom',
    matches: (url) => url.pathname === '/orders',
    action: (params) => {
      const values = params.getAll('status');
      if (!values.includes('late')) return;
      params.delete('status');
      for (const value of values.filter((v) => v !== 'late')) params.append('status', value);
      params.set('is_late', 'true');
    },
  },
  {
    type: 'custom',
    matches: (url) => url.pathname === '/old',
    action: (_params, url) => {
      url.pathname = '/new';
    },
  },
]);

const fixtures = [
  { from: '/orders?status=late', to: '/orders?is_late=true' },
  { from: '/old', to: '/new' },
];

const run = (overrides: Partial<Parameters<typeof checkMigrations>[0]> = {}) =>
  checkMigrations({ base, head, migrate, fixtures, ...overrides });

describe('checkMigrations', () => {
  it('passes when every breaking change has a verified example', () => {
    const result = run();
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.covered).toHaveLength(2);
  });

  it('passes when there are no breaking changes', () => {
    expect(checkMigrations({ base, head: base, migrate, fixtures: [] }).ok).toBe(true);
  });

  it('fails a breaking change that no example covers', () => {
    const result = run({ fixtures: [fixtures[1]!] });
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.message).join('\n')).toContain('"late"');
  });

  it('fails when the migration produces something other than the stated result', () => {
    const dropOnly = createURLMigration([
      { type: 'custom', matches: (url) => url.pathname === '/orders', action: (p) => p.delete('status') },
      { type: 'custom', matches: (url) => url.pathname === '/old', action: (_p, url) => void (url.pathname = '/new') },
    ]);
    const result = run({ migrate: dropOnly });
    expect(result.ok).toBe(false);
    expect(result.problems[0]?.message).toContain('/orders?status=late');
  });

  it('fails an example whose result is not valid in the new contract', () => {
    const result = run({ fixtures: [{ from: '/orders?status=late', to: '/orders?status=late' }, fixtures[1]!] });
    expect(result.ok).toBe(false);
  });

  it('fails an example whose old URL was never valid', () => {
    const result = run({ fixtures: [{ from: '/orders?status=bogus', to: '/orders' }, ...fixtures] });
    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.message).join('\n')).toContain('not valid in the base contract');
  });

  it('fails a migration that does not settle: running it on its own output changes the URL again', () => {
    const loop = createURLMigration([
      { type: 'custom', action: (_p, url) => void (url.pathname = url.pathname === '/new' ? '/orders' : '/new') },
    ]);
    const result = run({ migrate: loop, fixtures: [{ from: '/old', to: '/new' }] });
    expect(result.ok).toBe(false);
  });

  it('lets a waiver with a reason stand in for an example', () => {
    const result = run({
      fixtures: [fixtures[0]!],
      waivers: [{ route: '/old', reason: 'feature removed, no inbound links' }],
    });
    expect(result.ok).toBe(true);
    expect(result.waived).toHaveLength(1);
  });
});
