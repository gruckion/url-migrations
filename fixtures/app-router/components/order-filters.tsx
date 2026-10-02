'use client';
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';

import { parseAsYmd } from '@/lib/parsers';

const STATUSES = ['open', 'paid'] as const;

const PAGINATION = {
  page: parseAsInteger.withDefault(1),
};

const schema = {
  ...PAGINATION,
  status: parseAsStringLiteral([...STATUSES, 'void']).withDefault('open'),
  team_ids: parseAsArrayOf(parseAsString, ',').withDefault([]),
  from: parseAsYmd,
};

export function OrderFilters() {
  const [query] = useQueryStates(schema, { urlKeys: { page: 'p' } });
  return <div>{query.page}</div>;
}
