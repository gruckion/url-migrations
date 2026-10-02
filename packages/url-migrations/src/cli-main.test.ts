import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { run } from './cli-main';

const fixtureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures/app-router');

function scratch(): string {
  return mkdtempSync(path.join(tmpdir(), 'url-migrations-'));
}

describe('extract', () => {
  it('writes the contract and prints a summary', async () => {
    const out = path.join(scratch(), 'contract.json');
    const result = await run(['extract', '--root', fixtureRoot, '--out', out]);
    expect(result.code).toBe(0);
    expect(result.lines.join('\n')).toContain('5 routes');
    expect(JSON.parse(readFileSync(out, 'utf8')).version).toBe(1);
  });

  it('--check passes when the committed contract is current', async () => {
    const out = path.join(scratch(), 'contract.json');
    await run(['extract', '--root', fixtureRoot, '--out', out]);
    const result = await run(['extract', '--root', fixtureRoot, '--out', out, '--check']);
    expect(result.code).toBe(0);
  });

  it('--check fails when the committed contract is stale or missing', async () => {
    const dir = scratch();
    const missing = await run(['extract', '--root', fixtureRoot, '--out', path.join(dir, 'none.json'), '--check']);
    expect(missing.code).toBe(1);

    const stale = path.join(dir, 'stale.json');
    writeFileSync(stale, JSON.stringify({ version: 1, routes: {} }));
    const result = await run(['extract', '--root', fixtureRoot, '--out', stale, '--check']);
    expect(result.code).toBe(1);
    expect(result.lines.join('\n')).toContain('out of date');
    expect(JSON.parse(readFileSync(stale, 'utf8')).routes).toEqual({});
  });
});

describe('diff and check', () => {
  const contract = (params: Record<string, { kind: string }>) => ({ version: 1, routes: { '/a': { params } } });

  function setup() {
    const dir = scratch();
    const write = (name: string, body: string) => {
      const file = path.join(dir, name);
      writeFileSync(file, body);
      return file;
    };
    return {
      base: write('base.json', JSON.stringify(contract({ q: { kind: 'string' } }))),
      head: write('head.json', JSON.stringify(contract({}))),
      migrations: write(
        'migrations.mjs',
        `export const migrate = (input) => { const url = new URL(input); const had = url.searchParams.has('q'); url.searchParams.delete('q'); return { applied: had, url }; };
         export const fixtures = [{ from: '/a?q=x', to: '/a' }];`,
      ),
    };
  }

  it('diff exits 1 on a breaking change', async () => {
    const { base, head } = setup();
    const result = await run(['diff', base, head]);
    expect(result.code).toBe(1);
    expect(result.lines.join('\n')).toContain('breaking');
  });

  it('check exits 0 when an example covers the break and 1 when it does not', async () => {
    const { base, head, migrations } = setup();
    expect((await run(['check', base, head, '--migrations', migrations])).code).toBe(0);

    const dir = scratch();
    const none = path.join(dir, 'none.mjs');
    writeFileSync(
      none,
      'export const migrate = (i) => ({ applied: false, url: new URL(i) }); export const fixtures = [];',
    );
    expect((await run(['check', base, head, '--migrations', none])).code).toBe(1);
  });

  it('prints usage and exits 2 for an unknown command', async () => {
    const result = await run(['nope']);
    expect(result.code).toBe(2);
    expect(result.lines.join('\n')).toContain('extract');
  });
});
