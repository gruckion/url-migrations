export type ParamShape =
  | { kind: 'string' }
  | { kind: 'integer' }
  | { kind: 'float' }
  | { kind: 'boolean' }
  | { kind: 'date' }
  | { kind: 'datetime' }
  | { kind: 'timestamp' }
  | { kind: 'json' }
  /** A closed set of allowed values. `dynamic` means the set could not be read statically. */
  | { kind: 'enum'; values: string[]; dynamic?: true }
  | { kind: 'array'; item: ParamShape; separator: string }
  /** A custom parser, identified by name only. A rename is breaking, a behavior change is invisible. */
  | { kind: 'custom'; name: string }
  /** Read from the URL with no declared type, for example `useSearchParams().get('tab')`. */
  | { kind: 'untyped' }
  /** The same key is declared differently in different files that one route renders. */
  | { kind: 'mixed'; variants: ParamShape[] };

export interface RouteContract {
  params: Record<string, ParamShape>;
  /** True when the route renders code that reads URL state in a way a scan cannot list. */
  opaque?: true;
}

export interface Contract {
  version: 1;
  routes: Record<string, RouteContract>;
}

export interface ExtractWarning {
  file: string;
  line: number;
  message: string;
}

export interface ParamOrigin {
  route: string;
  key: string;
  file: string;
  line: number;
}

export interface ExtractResult {
  contract: Contract;
  warnings: ExtractWarning[];
  origins: ParamOrigin[];
  stats: { pages: number; filesScanned: number };
}

export type Severity = 'breaking' | 'safe' | 'warning';

export interface Change {
  severity: Severity;
  route: string;
  param?: string;
  message: string;
}
