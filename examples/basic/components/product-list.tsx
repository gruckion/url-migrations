'use client';

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

const SORTS = ['name', 'price'] as const;

export function ProductList() {
  const [{ q, sort, page }, setQuery] = useQueryStates({
    q: parseAsString.withDefault(''),
    sort: parseAsStringLiteral(SORTS).withDefault('name'),
    page: parseAsInteger.withDefault(1),
  });

  return (
    <div>
      <input value={q} onChange={(event) => setQuery({ q: event.target.value, page: 1 })} />
      <select value={sort} onChange={(event) => setQuery({ sort: event.target.value === 'price' ? 'price' : 'name' })}>
        {SORTS.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <button onClick={() => setQuery({ page: page + 1 })}>Next page</button>
    </div>
  );
}
