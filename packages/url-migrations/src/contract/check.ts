import type { MigrationResult } from '../index';
import { diffContracts } from './diff';
import type { Change, Contract } from './types';
import { validateURL } from './validate';

export interface Fixture {
  /** An URL that worked before the change. */
  from: string;
  /** The URL it must become. */
  to: string;
}

export interface Waiver {
  route: string;
  /** Omit to waive every breaking change on the route. */
  param?: string;
  /** Why old links do not need to keep working. */
  reason: string;
}

export interface Problem {
  message: string;
}

export interface CheckResult {
  ok: boolean;
  problems: Problem[];
  covered: Change[];
  waived: Change[];
}

export interface CheckInput {
  base: Contract;
  head: Contract;
  migrate: (input: string | URL) => MigrationResult;
  fixtures: readonly Fixture[];
  waivers?: readonly Waiver[];
}

const ORIGIN = 'https://example.com';

/**
 * Every breaking change needs a verified example: an old URL, the URL it becomes, and proof
 * that the migration really does that. A waiver with a reason is the only other way through.
 */
export function checkMigrations(input: CheckInput): CheckResult {
  const { base, head, migrate, fixtures } = input;
  const waivers = input.waivers ?? [];
  const problems: Problem[] = [];

  const verified = fixtures.filter((fixture) => {
    const fixtureProblems = verifyFixture(fixture, head, migrate);
    problems.push(...fixtureProblems);
    return fixtureProblems.length === 0;
  });

  const covered: Change[] = [];
  const waived: Change[] = [];
  for (const change of diffContracts(base, head)) {
    if (change.severity !== 'breaking') continue;
    if (waivers.some((waiver) => waives(waiver, change))) {
      waived.push(change);
    } else if (verified.some((fixture) => exhibits(fixture, change, base, head))) {
      covered.push(change);
    } else {
      problems.push({ message: `no verified example covers: ${describeChange(change)}` });
    }
  }
  return { ok: problems.length === 0, problems, covered, waived };
}

function describeChange(change: Change): string {
  return `${change.route}${change.param ? ` ?${change.param}` : ''}  ${change.message}`;
}

function waives(waiver: Waiver, change: Change): boolean {
  return waiver.route === change.route && (waiver.param === undefined || waiver.param === change.param);
}

function absolute(path: string): URL {
  return new URL(path, ORIGIN);
}

/** Same path and same params, ignoring param order. */
function sameURL(a: URL, b: URL): boolean {
  const normalize = (url: URL) => {
    const entries = [...url.searchParams.entries()].map(([k, v]) => `${k}=${v}`).sort();
    return `${url.pathname}?${entries.join('&')}`;
  };
  return normalize(a) === normalize(b);
}

/**
 * An older example may start from an URL that the base contract no longer accepts, since that
 * is what a past migration fixed. It must still migrate to the stated URL, which the head accepts.
 */
function verifyFixture(fixture: Fixture, head: Contract, migrate: CheckInput['migrate']): Problem[] {
  const label = `${fixture.from} -> ${fixture.to}`;
  const from = absolute(fixture.from);
  const to = absolute(fixture.to);
  const problems: Problem[] = [];

  const after = validateURL(head, to);
  if (after.route === null || after.issues.length) {
    problems.push({ message: `example ${label}: the new URL is not valid in the head contract` });
  }

  const migrated = migrate(from);
  if (!sameURL(migrated.url, to)) {
    const got = `${migrated.url.pathname}${migrated.url.search}`;
    problems.push({ message: `example ${label}: the migration produced ${got}` });
  } else if (migrate(migrated.url).applied) {
    problems.push({
      message: `example ${label}: running the migration again changes the URL, so a redirect would loop`,
    });
  }
  return problems;
}

/** The old URL is valid in the base contract on the changed route, and the head contract no longer accepts it. */
function exhibits(fixture: Fixture, change: Change, base: Contract, head: Contract): boolean {
  const from = absolute(fixture.from);
  const before = validateURL(base, from);
  if (before.route !== change.route || before.issues.length) return false;
  const after = validateURL(head, from);
  if (change.param === undefined) return after.route === null;
  return after.issues.some((issue) => issue.param === change.param);
}
