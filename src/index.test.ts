import { describe, expect, it } from 'vitest';

import { createURLMigration } from './index';

const origin = 'https://example.com';

describe('createURLMigration', () => {
  it('applies ordered rules without mutating the input, keeping duplicate values and the hash', () => {
    const input = new URL(`${origin}/test?old=a&old=b&drop=x&other=y#here`);
    const migrate = createURLMigration([
      { type: 'rename-key', from: 'old', to: 'new' },
      { type: 'remove-key', key: 'drop' },
      { type: 'update-value', key: 'new', action: (v) => v.toUpperCase() },
    ]);
    const result = migrate(input);
    expect(result.applied).toBe(true);
    expect(result.url.searchParams.getAll('new')).toEqual(['A', 'B']);
    expect(result.url.searchParams.get('other')).toBe('y');
    expect(result.url.hash).toBe('#here');
    expect(input.searchParams.has('old')).toBe(true);
    expect(migrate(result.url).applied).toBe(false);
  });

  it('keeps an explicitly supplied destination key', () => {
    const migrate = createURLMigration([{ type: 'rename-key', from: 'old', to: 'new' }]);
    expect(migrate(`${origin}/?old=a&new=b`).url.search).toBe('?new=b');
  });

  it('drops values whose update action returns null', () => {
    const migrate = createURLMigration([
      { type: 'update-value', key: 'tag', action: (v) => (v === 'legacy' ? null : v) },
    ]);
    expect(migrate(`${origin}/?tag=legacy&tag=keep`).url.search).toBe('?tag=keep');
  });

  it('reports applied=false when nothing matches', () => {
    const migrate = createURLMigration([{ type: 'rename-key', from: 'old', to: 'new' }]);
    expect(migrate(`${origin}/?other=1`).applied).toBe(false);
  });

  it('runs a rule only on URLs its matcher accepts', () => {
    const migrate = createURLMigration([
      { type: 'rename-key', from: 'q', to: 'search', matches: (url) => url.pathname.startsWith('/docs') },
    ]);
    expect(migrate(`${origin}/docs?q=a`).url.search).toBe('?search=a');
    expect(migrate(`${origin}/blog?q=a`).applied).toBe(false);
  });

  it('upgrades a URL that is several versions behind in one pass', () => {
    const migrate = createURLMigration([
      { type: 'rename-key', from: 'q', to: 'query' },
      { type: 'rename-key', from: 'query', to: 'search' },
    ]);
    expect(migrate(`${origin}/?q=a`).url.search).toBe('?search=a');
  });

  it('lets a custom rule rewrite params freely', () => {
    const migrate = createURLMigration([
      {
        type: 'custom',
        action: (params) => {
          if (params.get('sort') !== 'newest') return;
          params.set('sort', 'created_at');
          params.set('dir', 'desc');
        },
      },
    ]);
    const result = migrate(`${origin}/?sort=newest`);
    expect(result.url.search).toBe('?sort=created_at&dir=desc');
    expect(migrate(result.url).applied).toBe(false);
  });

  it('lets a custom rule rewrite the path as well', () => {
    const migrate = createURLMigration([
      {
        type: 'custom',
        matches: (url) => url.pathname === '/old',
        action: (params, url) => {
          url.pathname = '/new';
          params.set('moved', '1');
        },
      },
    ]);
    const result = migrate(`${origin}/old?a=1`);
    expect(result.url.pathname).toBe('/new');
    expect(result.url.search).toBe('?a=1&moved=1');
    expect(migrate(result.url).applied).toBe(false);
  });
});
