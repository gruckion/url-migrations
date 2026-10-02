export type MigrationAction =
  | { type: 'rename-key'; from: string; to: string }
  | { type: 'remove-key'; key: string }
  | { type: 'update-value'; key: string; action: (value: string) => string | null }
  | { type: 'custom'; action: (params: URLSearchParams) => void };

export type URLMigration = MigrationAction & {
  /** Scope the rule to some URLs, for example by pathname. Omit to run on every URL. */
  matches?: (url: URL) => boolean;
};

export interface MigrationResult {
  /** True when at least one rule changed the URL. */
  applied: boolean;
  /** The migrated URL. A new object: the input is never mutated. */
  url: URL;
}

/**
 * Build a function that upgrades old URLs to the current shape.
 *
 * Rules run in order, oldest first, so one pass upgrades a URL that is several
 * versions behind. Write each rule so that running it on its own output changes
 * nothing: then `applied` is false on the migrated URL and a redirect never loops.
 */
export function createURLMigration(migrations: readonly URLMigration[]) {
  return (input: string | URL): MigrationResult => {
    const url = new URL(input);
    const before = url.href;
    for (const migration of migrations) {
      if (migration.matches && !migration.matches(url)) continue;
      const params = url.searchParams;
      switch (migration.type) {
        case 'rename-key': {
          if (migration.from === migration.to || !params.has(migration.from)) break;
          // An explicit value for the new key wins over the old key.
          if (!params.has(migration.to)) {
            for (const value of params.getAll(migration.from)) params.append(migration.to, value);
          }
          params.delete(migration.from);
          break;
        }
        case 'remove-key':
          params.delete(migration.key);
          break;
        case 'update-value': {
          const values = params.getAll(migration.key);
          const updated = values.map(migration.action).filter((value): value is string => value !== null);
          if (JSON.stringify(values) === JSON.stringify(updated)) break;
          params.delete(migration.key);
          for (const value of updated) params.append(migration.key, value);
          break;
        }
        case 'custom':
          migration.action(params);
          break;
      }
    }
    return { applied: url.href !== before, url };
  };
}
