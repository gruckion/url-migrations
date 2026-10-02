# url-migrations

[![CI](https://github.com/gruckion/url-migrations/actions/workflows/ci.yml/badge.svg)](https://github.com/gruckion/url-migrations/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/url-migrations)](https://www.npmjs.com/package/url-migrations)
[![license](https://img.shields.io/npm/l/url-migrations)](LICENSE)

Keep old URLs working when your app changes. Fail CI when a URL change would break them.

Your app changes. A filter is renamed. A status value is removed. A page moves. Users still have the old URL in a bookmark, an email, or a shared link. This project does two jobs:

1. **Migrate.** A list of small rules turns an old URL into the current one. You redirect to the result.
2. **Detect.** A CLI reads your Next.js app, records every route and search param it reads, and compares that with the main branch. A breaking change fails the build until you add a migration and prove it works.

```text
breaking /orders ?status  param "status" no longer accepts "late"
problem  no verified example covers: /orders ?status  param "status" no longer accepts "late"
```

## Quick start

```sh
npm install url-migrations
```

**1. Write the migrations.**

```js
// url-migrations.mjs
import { createURLMigration } from 'url-migrations';

export const migrate = createURLMigration([{ type: 'rename-key', from: 'q', to: 'query' }]);

// An old URL and the URL it must become. The CLI checks each one.
export const fixtures = [{ from: '/search?q=shoes', to: '/search?query=shoes' }];
```

**2. Redirect old URLs.** In Next.js, in `middleware.ts` (`proxy.ts` on Next.js 16):

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { migrate } from './url-migrations.mjs';

export function middleware(request: NextRequest) {
  if (request.method === 'GET' || request.method === 'HEAD') {
    const migration = migrate(request.url);
    if (migration.applied) return NextResponse.redirect(migration.url);
  }
  return NextResponse.next();
}
```

**3. Gate the build.** Commit the URL contract and compare it with the main branch in CI.

```sh
npx url-migrations extract --out url-contract.json
npx url-migrations check base-contract.json url-contract.json --migrations ./url-migrations.mjs
```

Read the [full guide](packages/url-migrations/README.md) for every rule type, the contract, and the CI setup.

## What it reads

The scanner understands [nuqs](https://nuqs.dev) hooks and schemas, `useSearchParams().get('key')`, and typed `searchParams` props on pages. It follows imports from each page and layout to the code that reads the URL, so a param belongs to a route only when that route uses it.

It cannot see everything. When a route reads URL state in a way a scan cannot list, the route is marked `opaque` and you get a warning. The [guide](packages/url-migrations/README.md#what-it-cannot-see) lists the cases.

## In this repository

| Path                                                 | What it is                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`packages/url-migrations`](packages/url-migrations) | The library and the CLI. This is what you install.                             |
| [`examples/basic`](examples/basic)                   | The smallest Next.js app that uses it, with the CI gate.                       |
| [`examples/kitchen-sink`](examples/kitchen-sink)     | Every rule type, a moved route, shared schemas, and the limits of the scanner. |

The [workflow](.github/workflows/examples.yml) runs the gate on every pull request that touches an example. Open a pull request that renames a value in `examples/basic` without a migration, and you can watch it fail.

## Contributing

Bug reports, ideas, and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

```sh
pnpm install
pnpm build
pnpm test
```

## Credit

The rule shapes follow a design sketch by [François Best](https://x.com/fortysevenfx), author of [nuqs](https://nuqs.dev). This is an independent project and is not part of nuqs.

## License

[MIT](LICENSE)
