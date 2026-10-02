import { describeShape, sameShape } from './shape';
import type { Change, Contract, ParamShape, RouteContract } from './types';

/** Compare two contracts. Removed or narrowed URL surface is breaking, new surface is safe. */
export function diffContracts(base: Contract, head: Contract): Change[] {
  const changes: Change[] = [];

  for (const route of Object.keys(base.routes).sort()) {
    const before = base.routes[route];
    if (!before) continue;
    const after = head.routes[route];
    if (!after) {
      changes.push({ severity: 'breaking', route, message: `route ${route} was removed` });
      continue;
    }
    diffRoute(route, before, after, changes);
  }
  for (const route of Object.keys(head.routes).sort()) {
    if (!base.routes[route]) changes.push({ severity: 'safe', route, message: `route ${route} was added` });
  }
  return changes;
}

function diffRoute(route: string, before: RouteContract, after: RouteContract, changes: Change[]) {
  const removed: string[] = [];
  const added: string[] = [];

  for (const key of Object.keys(before.params).sort()) {
    const beforeShape = before.params[key];
    const afterShape = after.params[key];
    if (!beforeShape) continue;
    if (!afterShape) {
      removed.push(key);
      continue;
    }
    changes.push(...diffShape(route, key, beforeShape, afterShape));
  }
  for (const key of Object.keys(after.params).sort()) {
    if (!before.params[key]) added.push(key);
  }

  for (const key of removed) {
    const beforeShape = before.params[key];
    const rename = added.find((candidate) => {
      const candidateShape = after.params[candidate];
      return beforeShape && candidateShape && sameShape(beforeShape, candidateShape);
    });
    const hint = rename ? ` (looks like a rename to "${rename}")` : '';
    changes.push({ severity: 'breaking', route, param: key, message: `param "${key}" was removed${hint}` });
  }
  for (const key of added) {
    changes.push({ severity: 'safe', route, param: key, message: `param "${key}" was added` });
  }
  if (after.opaque && !before.opaque) {
    changes.push({
      severity: 'warning',
      route,
      message: 'route now reads URL state a scan cannot list, so later changes to it will go unchecked',
    });
  }
}

function variantsOf(shape: ParamShape): ParamShape[] {
  return shape.kind === 'mixed' ? shape.variants : [shape];
}

/** Two variants describe the same slot when their kind, and for arrays their separator, match. */
function sameSlot(a: ParamShape, b: ParamShape): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'array' || (b.kind === 'array' && a.separator === b.separator);
}

function diffMixed(route: string, param: string, before: ParamShape, after: ParamShape): Change[] {
  const changes: Change[] = [];
  const unmatchedAfter = new Set(variantsOf(after));
  for (const variant of variantsOf(before)) {
    const match = [...unmatchedAfter].find((candidate) => sameSlot(variant, candidate));
    if (!match) {
      changes.push({
        severity: 'breaking',
        route,
        param,
        message: `param "${param}" no longer accepts ${describeShape(variant)}`,
      });
      continue;
    }
    unmatchedAfter.delete(match);
    changes.push(...diffShape(route, param, variant, match));
  }
  for (const variant of unmatchedAfter) {
    changes.push({
      severity: 'safe',
      route,
      param,
      message: `param "${param}" now also accepts ${describeShape(variant)}`,
    });
  }
  return changes;
}

function diffShape(route: string, param: string, before: ParamShape, after: ParamShape): Change[] {
  if (sameShape(before, after)) return [];
  if (before.kind === 'mixed' || after.kind === 'mixed') return diffMixed(route, param, before, after);
  if (before.kind === 'enum' && after.kind === 'enum') {
    const dropped = before.values.filter((value) => !after.values.includes(value));
    const gained = after.values.filter((value) => !before.values.includes(value));
    const changes: Change[] = [];
    if (dropped.length) {
      changes.push({
        severity: 'breaking',
        route,
        param,
        message: `param "${param}" no longer accepts ${dropped.map((v) => `"${v}"`).join(', ')}`,
      });
    }
    if (gained.length) {
      changes.push({
        severity: 'safe',
        route,
        param,
        message: `param "${param}" now also accepts ${gained.map((v) => `"${v}"`).join(', ')}`,
      });
    }
    return changes;
  }
  if (before.kind === 'array' && after.kind === 'array' && before.separator === after.separator) {
    return diffShape(route, param, before.item, after.item);
  }
  return [
    {
      severity: 'breaking',
      route,
      param,
      message: `param "${param}" changed from ${describeShape(before)} to ${describeShape(after)}`,
    },
  ];
}
