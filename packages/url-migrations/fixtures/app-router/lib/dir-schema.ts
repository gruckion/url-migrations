import { parseAsStringEnum } from 'nuqs';

import { Direction } from './direction';

export const DIR_SCHEMA = {
  dir: parseAsStringEnum<Direction>(Object.values(Direction)),
};
