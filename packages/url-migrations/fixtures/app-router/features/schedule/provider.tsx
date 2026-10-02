'use client';
import { createContext, useContext } from 'react';
import { parseAsString, useQueryStates } from 'nuqs';

const Ctx = createContext<string | null>(null);

// Reads the URL: only routes that render this provider have these params.
export function ScheduleProvider({ children }: { children: React.ReactNode }) {
  const [query] = useQueryStates({ lane: parseAsString.withDefault('') });
  return <Ctx.Provider value={query.lane}>{children}</Ctx.Provider>;
}

// Reads context only: importing this must not pull in the provider's params.
export function useScheduleLane() {
  return useContext(Ctx);
}
