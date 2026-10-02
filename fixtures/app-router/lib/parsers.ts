import { createParser } from 'nuqs';

export const parseAsYmd = createParser({
  parse: (value: string) => value,
  serialize: (value: string) => value,
});
