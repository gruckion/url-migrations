# basic

The smallest Next.js app that uses `url-migrations` and the CI gate.

- `components/product-list.tsx` reads `q`, `sort` and `page` with nuqs.
- `url-migrations.mjs` holds one migration (`search` was renamed to `q`) and the example that proves it.
- `proxy.ts` redirects old URLs to the current ones.
- `url-contract.json` is the committed URL contract. It shows up in pull request diffs.

```sh
pnpm install && pnpm build          # from the repo root
pnpm contract                       # regenerate url-contract.json
pnpm contract:check                 # fail if it is out of date
BASE_CONTRACT=path/to/old.json pnpm gate
```

## Try the gate

On a branch, change `SORTS` in `components/product-list.tsx` from `['name', 'price']` to `['name', 'price_asc']`, then run `pnpm contract`. The gate fails:

```text
problem  no verified example covers: /products ?sort  param "sort" no longer accepts "price"
```

Add a `custom` or `update-value` rule to `url-migrations.mjs` and an example (`/products?sort=price` -> `/products?sort=price_asc`). The gate passes.
