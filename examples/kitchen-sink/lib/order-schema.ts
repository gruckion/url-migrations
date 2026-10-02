import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringEnum, parseAsStringLiteral } from 'nuqs';

import { parseAsYmd } from './parsers';

export enum Direction {
  Asc = 'asc',
  Desc = 'desc',
}

export const STATUSES = ['open', 'paid', 'void'] as const;
export const SORTS = ['created', 'total'] as const;

const PAGINATION = {
  page: parseAsInteger.withDefault(1),
  pageSize: parseAsInteger.withDefault(25),
};

/** Shared by the filters and by link builders, so the URL has one definition. */
export const orderSchema = {
  ...PAGINATION,
  status: parseAsStringLiteral(STATUSES),
  team_ids: parseAsArrayOf(parseAsString, ',').withDefault([]),
  sort: parseAsStringLiteral(SORTS).withDefault('created'),
  dir: parseAsStringEnum<Direction>(Object.values(Direction)).withDefault(Direction.Desc),
  from: parseAsYmd,
  to: parseAsYmd,
};

/** The URL key for page size is `ps`. The scanner reports `ps`, not `pageSize`. */
export const orderUrlKeys = { pageSize: 'ps' } as const;
