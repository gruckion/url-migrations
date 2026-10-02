import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { checkMigrations, diffContracts, extractContract, type Contract, type Fixture, type Waiver } from './contract';
import type { MigrationResult } from './index';

export const USAGE = `url-migrations <command>

  extract [--root .] [--app app] [--tsconfig tsconfig.json] [--out url-contract.json] [--explain] [--check]
      Scan an app router project and write its URL contract.
      With --check, write nothing and exit 1 when the file at --out is missing or out of date.

  diff <base.json> <head.json>
      Compare two contracts. Exits 1 when the change breaks existing URLs.

  check <base.json> <head.json> --migrations <module.mjs>
      Fail unless every breaking change has a verified old URL -> new URL example.
      The module exports: migrate (from createURLMigration), fixtures [{ from, to }],
      and optionally waivers [{ route, param?, reason }].
`;

function flags(args: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg?.startsWith('--')) continue;
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) map.set(arg.slice(2), 'true');
    else {
      map.set(arg.slice(2), next);
      i++;
    }
  }
  return map;
}

function loadContract(file: string): Contract {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
  if (!isContract(parsed)) throw new Error(`${file} is not a url-migrations contract`);
  return parsed;
}

function isContract(value: unknown): value is Contract {
  return typeof value === 'object' && value !== null && 'version' in value && 'routes' in value;
}

interface MigrationsModule {
  migrate: (input: string | URL) => MigrationResult;
  fixtures: Fixture[];
  waivers: Waiver[];
}

async function loadMigrations(file: string): Promise<MigrationsModule> {
  const mod: Record<string, unknown> = await import(pathToFileURL(path.resolve(file)).href);
  const { migrate, fixtures, waivers } = mod;
  if (typeof migrate !== 'function') throw new Error(`${file} must export "migrate" (from createURLMigration)`);
  if (!Array.isArray(fixtures)) throw new Error(`${file} must export "fixtures": [{ from, to }]`);
  if (waivers !== undefined && !Array.isArray(waivers)) throw new Error(`${file} "waivers" must be an array`);
  return { migrate: (input) => migrate(input), fixtures, waivers: waivers ?? [] };
}

export interface RunResult {
  code: number;
  lines: string[];
}

export async function run(argv: string[]): Promise<RunResult> {
  const lines: string[] = [];
  const code = await execute(argv, (line) => lines.push(line));
  return { code, lines };
}

async function execute(argv: string[], print: (line: string) => void): Promise<number> {
  const [command, ...rest] = argv;
  if (command === 'extract') {
    const f = flags(rest);
    const result = extractContract({ root: f.get('root') ?? '.', appDir: f.get('app'), tsconfig: f.get('tsconfig') });
    const out = f.get('out') ?? 'url-contract.json';
    const serialized = `${JSON.stringify(result.contract, null, 2)}\n`;
    if (f.has('check')) {
      const current = existsSync(out) ? readFileSync(out, 'utf8') : null;
      if (current === serialized) {
        print(`${out} is up to date`);
        return 0;
      }
      print(`${out} is ${current === null ? 'missing' : 'out of date'}. Run extract and commit the result.`);
      return 1;
    }
    writeFileSync(out, serialized);
    const paramCount = Object.values(result.contract.routes).reduce((n, r) => n + Object.keys(r.params).length, 0);
    const opaque = Object.values(result.contract.routes).filter((r) => r.opaque).length;
    print(`${result.stats.pages} routes, ${paramCount} params, ${opaque} opaque routes -> ${out}`);
    for (const w of result.warnings) print(`warning ${w.file}:${w.line} ${w.message}`);
    if (f.has('explain')) for (const o of result.origins) print(`${o.route} ${o.key} <- ${o.file}:${o.line}`);
    return 0;
  }
  if (command === 'diff') {
    const [basePath, headPath] = rest;
    if (!basePath || !headPath) {
      print(USAGE);
      return 2;
    }
    const changes = diffContracts(loadContract(basePath), loadContract(headPath));
    for (const c of changes) print(`${c.severity.padEnd(8)} ${c.route}${c.param ? ` ?${c.param}` : ''}  ${c.message}`);
    if (!changes.length) print('no URL changes');
    return changes.some((c) => c.severity === 'breaking') ? 1 : 0;
  }
  if (command === 'check') {
    const [basePath, headPath, ...flagArgs] = rest;
    const migrationsPath = flags(flagArgs).get('migrations');
    if (!basePath || !headPath || !migrationsPath) {
      print(USAGE);
      return 2;
    }
    const migrations = await loadMigrations(migrationsPath);
    const result = checkMigrations({
      base: loadContract(basePath),
      head: loadContract(headPath),
      migrate: migrations.migrate,
      fixtures: migrations.fixtures,
      waivers: migrations.waivers,
    });
    for (const c of result.covered) print(`covered  ${c.route}${c.param ? ` ?${c.param}` : ''}  ${c.message}`);
    for (const c of result.waived) print(`waived   ${c.route}${c.param ? ` ?${c.param}` : ''}  ${c.message}`);
    for (const p of result.problems) print(`problem  ${p.message}`);
    if (result.ok) print('ok');
    return result.ok ? 0 : 1;
  }
  print(USAGE);
  return command ? 2 : 0;
}
