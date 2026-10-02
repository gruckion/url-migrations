'use client';
import { parseAsString, useQueryState } from 'nuqs';

export function Tabs() {
  const [tab] = useQueryState('tab', parseAsString.withDefault('details'));
  return <div>{tab}</div>;
}
