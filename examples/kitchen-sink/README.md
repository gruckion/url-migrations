# kitchen-sink

Every feature in one Next.js app.

| Where                          | Shows                                                                                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `url-migrations.mjs`           | all four rule types, `matches`, a rule that moves a route, ordered rules, and a waiver slot                                  |
| `lib/order-schema.ts`          | a shared nuqs schema with a spread, `urlKeys` (`pageSize` is `ps` in the URL), a TS enum, and a custom parser                |
| `app/orders/[id]/page.tsx`     | typed `searchParams` page props                                                                                              |
| `app/layout.tsx`               | a param (`theme`) that belongs to every route                                                                                |
| `features/orders/provider.tsx` | a provider that reads the URL, next to a hook that only reads context. Only routes that render the provider carry `selected` |
| `components/range-picker.tsx`  | `useSearchParams().get('range')`, listed as `untyped`                                                                        |
| `components/raw-export.tsx`    | the limit: the whole query string is passed on, so the route is `opaque` and the gate cannot check it                        |

```sh
pnpm install && pnpm build          # from the repo root
pnpm contract
BASE_CONTRACT=path/to/old.json pnpm gate
```
