'use client';

import { useSelection } from '@/features/orders/provider';

export function SelectionBadge() {
  return <span>{useSelection()}</span>;
}
