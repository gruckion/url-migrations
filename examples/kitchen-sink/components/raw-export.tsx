'use client';

import { useSearchParams } from 'next/navigation';

/**
 * The whole query string is passed on, so a scan cannot list the params. The route is marked
 * "opaque" and `check` cannot tell you when a change here breaks a URL.
 */
export function RawExport() {
  const params = useSearchParams();
  return <a href={`/api/export?${params.toString()}`}>Export</a>;
}
