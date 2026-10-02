'use client';
import { useSearchParams } from 'next/navigation';

export function LegacyReader() {
  const params = useSearchParams();
  return <div>{params.get('ref')}</div>;
}
