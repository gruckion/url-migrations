'use client';

import { useSearchParams } from 'next/navigation';

/** Plain `useSearchParams` with a literal key: listed, but only as `untyped`. */
export function RangePicker() {
  const params = useSearchParams();
  return <span>{params.get('range')}</span>;
}
