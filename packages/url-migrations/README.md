# url-migrations

Turn old URLs into current ones with a list of small rules.

Apps change. A filter gets renamed, a value is replaced, a status moves to a new flag. Users still have the old URL in a bookmark, an email, or a shared link. Run those URLs through `url-migrations` and redirect to the new shape, so old links keep working.

The migration helper has no dependencies. It works on the standard `URL` object, so it runs in Node, edge runtimes, and the browser. The CLI needs `typescript` (any Next.js project already has it).

```sh
npm install url-migrations
```

Requires Node.js 18 or newer.

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

| Type           | Does                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `rename-key`   | Moves every value from `from` to `to`. If `to` is already present, it wins and `from` is dropped. |
| `remove-key`   | Deletes the key.                                                                                  |
| `update-value` | Maps each value of a key. Return `null` to drop a value.                                          |
| `custom`       | Gets the `URLSearchParams` to change in place.                                                    |

Every rule accepts an optional `matches(url)`. The rule runs only when it returns true. Use it to scope a rule to a pathname.

## Behavior

- **Ordered.** Rules run top to bottom. List them oldest first, so one pass upgrades a URL that is several versions behind.
- **No mutation.** The input is never changed. You get a new `URL` back, and the hash is kept.
- **Idempotent, if you write it that way.** Running the migration on its own output should return `applied: false`. If it does not, a redirect can loop. Test this for each rule.
- **Params first, path if you need it.** The built-in rules edit search params. A `custom` rule also receives the `URL`, so it can change `url.pathname` to move a route.

## Test your rules

```ts
const result = migrateURL('https://example.com/orders?status=late');
expect(result.url.search).toBe('?is_late=true');
expect(migrateURL(result.url).applied).toBe(false); // no redirect loop
```

## Detect breaking URL changes (experimental)

Migrations only help if you remember to write them. The CLI makes forgetting a CI failure.

It reads your Next.js app router project and writes a **URL contract**: every route, the search params each route reads, and for each param its type and allowed values.

```sh
npx url-migrations extract --out url-contract.json
```

Commit the contract. In CI, compare it against the one on your target branch:

```sh
npx url-migrations diff base-contract.json url-contract.json
```

```text
breaking /orders ?status  param "status" no longer accepts "LATE"
safe     /orders ?is_late  param "is_late" was added
```

The exit code is 1 when a change breaks existing URLs: a removed route, a removed or retyped param, or a removed enum value. New routes, params and values are safe. A removed param that matches a new param of the same type is reported as a likely rename.

### Make forgetting a CI failure

`check` fails unless every breaking change has a verified example: an old URL, the URL it must become, and proof that your migration does exactly that.

```js
// url-migrations.mjs
import { createURLMigration } from 'url-migrations';

export const migrate = createURLMigration([
  {
    type: 'custom',
    matches: (url) => url.pathname === '/orders',
    action: (params) => {
      if (params.get('status') === 'late') {
        params.delete('status');
        params.set('is_late', 'true');
      }
    },
  },
]);

export const fixtures = [{ from: '/orders?status=late', to: '/orders?is_late=true' }];

// Optional. A break that needs no migration, with the reason.
export const waivers = [{ route: '/retired-page', reason: 'feature removed, no inbound links' }];
```

```sh
npx url-migrations check base-contract.json url-contract.json --migrations ./url-migrations.mjs
```

```text
covered  /orders ?status  param "status" no longer accepts "late"
ok
```

For each example, `check` verifies that:

- `migrate(old)` equals the new URL you wrote
- the new URL is valid in the head contract
- running `migrate` again on the new URL changes nothing, so a redirect cannot loop

An example counts toward a breaking change only if its old URL was valid in the base contract and the head contract no longer accepts it. Older examples, whose old URL the base contract already dropped, stay in the list as regression tests.

A migration that only deletes `status=late` would pass a validity check and lose the user's intent. That is why you write the expected result by hand.

In CI, commit each app's contract and compare it with the one on the target branch. See [`examples/`](https://github.com/gruckion/url-migrations/tree/main/examples) and the [workflow](https://github.com/gruckion/url-migrations/blob/main/.github/workflows/examples.yml) for a working setup. The short version:

```yaml
- run: git show origin/${{ github.base_ref }}:url-contract.json > base-contract.json
- run: npx url-migrations extract --check # the committed contract is current
- run: npx url-migrations check base-contract.json url-contract.json --migrations ./url-migrations.mjs
```

### What it reads

- [nuqs](https://nuqs.dev) hooks and schemas: `useQueryState`, `useQueryStates`, `createLoader`, `createSerializer`, `createSearchParamsCache`, including `urlKeys`, spread schemas, and enum values from const arrays, enums and `Object.values`.
- `useSearchParams().get('key')` with a literal key (recorded as `untyped`).
- Inline `searchParams` prop types on `page` files.

A param belongs to a route only when that route's page or layouts actually reference the code that reads it. Importing a context hook from a provider file does not pull in the provider's params.

### What it cannot see

The scan marks a route `opaque` and prints a warning when it finds URL state it cannot list:

- search params passed on whole (`Object.fromEntries(params)`, `params.toString()`) or read with a computed key
- schemas built at runtime
- hardcoded links that build query strings by hand
- values inside a single param, such as a JSON filter tree

Treat an `opaque` route as unchecked: `check` cannot tell you that a change there broke a URL. The fix is to declare that state with a typed parser.

Path-only changes inside a route's own dynamic segments are not diffed beyond the route pattern.

## Credit

The rule shapes follow a design sketch by [François Best](https://x.com/fortysevenfx), author of [nuqs](https://nuqs.dev). See also the nuqs post [Beware the URL type safety iceberg](https://nuqs.dev/blog/beware-the-url-type-safety-iceberg). This is an independent implementation and is not part of nuqs.

## Contributing

Bug reports and pull requests are welcome. See [CONTRIBUTING.md](https://github.com/gruckion/url-migrations/blob/main/CONTRIBUTING.md).

## License

MIT
