import { readFileSync, writeFileSync } from 'node:fs';

import { diffContracts, extractContract, type Contract } from './contract';

const USAGE = `url-migrations <command>

  extract [--root .] [--app app] [--tsconfig tsconfig.json] [--out url-contract.json] [--explain]
      Scan an app router project and write its URL contract.

  diff <base.json> <head.json>
      Compare two contracts. Exits 1 when the change breaks existing URLs.
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

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === 'extract') {
    const f = flags(rest);
    const result = extractContract({ root: f.get('root') ?? '.', appDir: f.get('app'), tsconfig: f.get('tsconfig') });
    const out = f.get('out') ?? 'url-contract.json';
    writeFileSync(out, `${JSON.stringify(result.contract, null, 2)}\n`);
    const paramCount = Object.values(result.contract.routes).reduce((n, r) => n + Object.keys(r.params).length, 0);
    const opaque = Object.values(result.contract.routes).filter((r) => r.opaque).length;
    console.log(`${result.stats.pages} routes, ${paramCount} params, ${opaque} opaque routes -> ${out}`);
    for (const w of result.warnings) console.warn(`warning ${w.file}:${w.line} ${w.message}`);
    if (f.has('explain')) for (const o of result.origins) console.log(`${o.route} ${o.key} <- ${o.file}:${o.line}`);
    return 0;
  }
  if (command === 'diff') {
    const [basePath, headPath] = rest;
    if (!basePath || !headPath) {
      console.error(USAGE);
      return 2;
    }
    const changes = diffContracts(loadContract(basePath), loadContract(headPath));
    for (const c of changes) console.log(`${c.severity.padEnd(8)} ${c.route}${c.param ? ` ?${c.param}` : ''}  ${c.message}`);
    if (!changes.length) console.log('no URL changes');
    return changes.some((c) => c.severity === 'breaking') ? 1 : 0;
  }
  console.error(USAGE);
  return command ? 2 : 0;
}

process.exitCode = main(process.argv.slice(2));
