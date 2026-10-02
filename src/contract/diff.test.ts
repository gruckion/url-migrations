import { describe, expect, it } from 'vitest';

import { diffContracts } from './diff';
import type { Contract, ParamShape } from './types';

function contract(routes: Record<string, Record<string, ParamShape>>): Contract {
  return {
    version: 1,
    routes: Object.fromEntries(Object.entries(routes).map(([route, params]) => [route, { params }])),
  };
}

const string: ParamShape = { kind: 'string' };
const statusEnum = (...values: string[]): ParamShape => ({ kind: 'enum', values });

describe('diffContracts', () => {
  it('treats additions as safe', () => {
    const changes = diffContracts(contract({ '/a': { x: string } }), contract({ '/a': { x: string, y: string }, '/b': {} }));
    expect(changes.map((c) => c.severity)).toEqual(['safe', 'safe']);
  });

  it('treats a removed route as breaking', () => {
    const [change] = diffContracts(contract({ '/a': {} }), contract({}));
    expect(change?.severity).toBe('breaking');
  });

  it('treats a removed param as breaking and suggests a same-shape rename', () => {
    const changes = diffContracts(contract({ '/a': { q: string } }), contract({ '/a': { query: string } }));
    const breaking = changes.find((c) => c.severity === 'breaking');
    expect(breaking?.message).toContain('looks like a rename to "query"');
  });

  it('treats a removed enum value as breaking and an added one as safe', () => {
    const changes = diffContracts(
      contract({ '/a': { status: statusEnum('open', 'late') } }),
      contract({ '/a': { status: statusEnum('open', 'void') } })
    );
    expect(changes.find((c) => c.severity === 'breaking')?.message).toContain('"late"');
    expect(changes.find((c) => c.severity === 'safe')?.message).toContain('"void"');
  });

  it('treats a type change as breaking', () => {
    const changes = diffContracts(contract({ '/a': { n: string } }), contract({ '/a': { n: { kind: 'integer' } } }));
    expect(changes[0]?.severity).toBe('breaking');
  });

  it('reports nothing for identical contracts', () => {
    const c = contract({ '/a': { x: string } });
    expect(diffContracts(c, c)).toEqual([]);
  });

  it('reads inside mixed shapes so a dropped enum value is named', () => {
    const list = (...values: string[]): ParamShape => ({
      kind: 'array',
      separator: ',',
      item: { kind: 'enum', values },
    });
    const mixed = (...variants: ParamShape[]): ParamShape => ({ kind: 'mixed', variants });
    const changes = diffContracts(
      contract({ '/a': { status: mixed(list('OPEN', 'LATE'), statusEnum('FAILED')) } }),
      contract({ '/a': { status: mixed(list('OPEN'), statusEnum('FAILED')) } })
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ severity: 'breaking' });
    expect(changes[0]?.message).toBe('param "status" no longer accepts "LATE"');
  });

  it('treats a dropped variant of a mixed shape as breaking', () => {
    const changes = diffContracts(
      contract({ '/a': { v: { kind: 'mixed', variants: [string, { kind: 'integer' }] } } }),
      contract({ '/a': { v: string } })
    );
    expect(changes.some((c) => c.severity === 'breaking')).toBe(true);
  });
});
