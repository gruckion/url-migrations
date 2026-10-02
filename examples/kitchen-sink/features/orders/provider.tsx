'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { parseAsString, useQueryState } from 'nuqs';

const SelectionContext = createContext<string | null>(null);

/** Reads the URL, so only routes that render it carry the `selected` param. */
export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selected] = useQueryState('selected', parseAsString);
  return <SelectionContext.Provider value={selected}>{children}</SelectionContext.Provider>;
}

/** Reads context only. A component that calls this does not add `selected` to its route. */
export function useSelection() {
  return useContext(SelectionContext);
}
