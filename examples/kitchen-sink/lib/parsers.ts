import { createParser } from 'nuqs';

/** A calendar date as YYYY-MM-DD. The contract records this as a custom parser, by name. */
export const parseAsYmd = createParser({
  parse: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null),
  serialize: (value: string) => value,
});
