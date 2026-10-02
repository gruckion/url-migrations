'use client';
import { useScheduleLane } from '@/features/schedule/provider';

export function GlobalBar() {
  return <div>{useScheduleLane()}</div>;
}
