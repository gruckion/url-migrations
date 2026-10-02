'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

export function CustomerStatus() {
  const [status] = useQueryState('status', parseAsStringLiteral(['open', 'closed']));
  return <span>{status}</span>;
}
