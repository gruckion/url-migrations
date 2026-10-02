'use client';
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from 'nuqs';

import { DIR_SCHEMA } from '@/lib/dir-schema';
import { KEYS } from '@/lib/keys';

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
  ...DIR_SCHEMA,
};

export function OrderFilters() {
  const [query] = useQueryStates(schema, { urlKeys: KEYS });
  return <div>{query.page}</div>;
}
