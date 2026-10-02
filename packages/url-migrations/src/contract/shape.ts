import type { ParamShape } from './types';

function stable(shape: ParamShape): string {
  return JSON.stringify(shape);
}

export function sameShape(a: ParamShape, b: ParamShape): boolean {
  return stable(a) === stable(b);
}

/** Combine two declarations of one key into the shape that accepts both. */
export function mergeShapes(a: ParamShape, b: ParamShape): ParamShape {
  if (sameShape(a, b)) return a;
  if (a.kind === 'enum' && b.kind === 'enum') {
    const values = [...new Set([...a.values, ...b.values])].sort();
    return a.dynamic || b.dynamic ? { kind: 'enum', values, dynamic: true } : { kind: 'enum', values };
  }
  if (a.kind === 'array' && b.kind === 'array' && a.separator === b.separator) {
    return { kind: 'array', separator: a.separator, item: mergeShapes(a.item, b.item) };
  }
  const variants = [...(a.kind === 'mixed' ? a.variants : [a]), ...(b.kind === 'mixed' ? b.variants : [b])];
  const unique = new Map(variants.map((variant) => [stable(variant), variant]));
  const sorted = [...unique.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([, variant]) => variant);
  return sorted.length === 1 && sorted[0] ? sorted[0] : { kind: 'mixed', variants: sorted };
}

export function describeShape(shape: ParamShape): string {
  switch (shape.kind) {
    case 'enum':
      return `enum(${shape.values.join('|')})${shape.dynamic ? '+dynamic' : ''}`;
    case 'array':
      return `array<${describeShape(shape.item)}>(sep '${shape.separator}')`;
    case 'custom':
      return `custom(${shape.name})`;
    case 'mixed':
      return `mixed(${shape.variants.map(describeShape).join(' | ')})`;
    default:
      return shape.kind;
  }
}
