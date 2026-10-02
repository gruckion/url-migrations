'use client';
import { useSearchParams } from 'next/navigation';

export function OpaqueReader() {
  const params = useSearchParams();
  return <div>{Object.fromEntries(params).x}</div>;
}
