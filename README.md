# url-migrations

Turn old URLs into current ones with a list of small rules.

Apps change. A filter gets renamed, a value is replaced, a status moves to a new flag. Users still have the old URL in a bookmark, an email, or a shared link. Run those URLs through `url-migrations` and redirect to the new shape, so old links keep working.

Zero dependencies. It works on the standard `URL` object, so it runs in Node, edge runtimes, and the browser.

```sh
pnpm add url-migrations
```

## Usage

```ts
import { createURLMigration } from 'url-migrations';

export const migrateURL = createURLMigration([
  // /search?q=shoes -> /search?query=shoes
  { type: 'rename-key', from: 'q', to: 'query' },

  // Drop a parameter that no longer does anything.
  { type: 'remove-key', key: 'utm_legacy' },

  // Rewrite a value. Return null to drop it.
  { type: 'update-value', key: 'sort', action: (v) => (v === 'newest' ? 'created_at' : v) },

  // Full control, limited to one part of the app.
  {
    type: 'custom',
    matches: (url) => url.pathname.startsWith('/orders'),
    action: (params) => {
      if (params.get('status') === 'late') {
        params.delete('status');
        params.set('is_late', 'true');
      }
    },
  },
]);

const { applied, url } = migrateURL('https://example.com/search?q=shoes');
// applied: true, url: https://example.com/search?query=shoes
```

### Next.js

Redirect in `middleware.ts` (`proxy.ts` on Next.js 16):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { migrateURL } from './lib/migrate-url';

export function middleware(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const migration = migrateURL(request.url);
    if (migration.applied) return NextResponse.redirect(migration.url);
  }
  return NextResponse.next();
}
```

## Rules

| Type           | Does                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------- |
| `rename-key`   | Moves every value from `from` to `to`. If `to` is already present, it wins and `from` is dropped. |
| `remove-key`   | Deletes the key.                                                                              |
| `update-value` | Maps each value of a key. Return `null` to drop a value.                                      |
| `custom`       | Gets the `URLSearchParams` to change in place.                                                |

Every rule accepts an optional `matches(url)`. The rule runs only when it returns true. Use it to scope a rule to a pathname.

## Behavior

- **Ordered.** Rules run top to bottom. List them oldest first, so one pass upgrades a URL that is several versions behind.
- **No mutation.** The input is never changed. You get a new `URL` back, and the hash is kept.
- **Idempotent, if you write it that way.** Running the migration on its own output should return `applied: false`. If it does not, a redirect can loop. Test this for each rule.
- **Search params only.** Path changes are not migrated. Use your framework's redirect config for those.

## Test your rules

```ts
const result = migrateURL('https://example.com/orders?status=late');
expect(result.url.search).toBe('?is_late=true');
expect(migrateURL(result.url).applied).toBe(false); // no redirect loop
```

## Not included

This package migrates URLs. It does not tell you when a URL change needs a migration. Catching a breaking change anywhere in the URL structure, not only in search params, is a separate and harder problem. Pull requests and ideas are welcome.

## Credit

The rule shapes follow a design sketch by [François Best](https://x.com/fortysevenfx), author of [nuqs](https://nuqs.dev). See also the nuqs post [Beware the URL type safety iceberg](https://nuqs.dev/blog/beware-the-url-type-safety-iceberg). This is an independent implementation and is not part of nuqs.

## License

MIT
