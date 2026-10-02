# url-migrations

Keep old URLs working when your app changes, and fail CI when a URL change would break them.

- **[`packages/url-migrations`](packages/url-migrations)**: the library and CLI. Start with its README.
- **[`examples/basic`](examples/basic)**: the smallest Next.js app that uses it, with the CI gate.
- **[`examples/kitchen-sink`](examples/kitchen-sink)**: every rule type, a moved route, a waiver, and the cases the scanner cannot see.

```sh
pnpm install
pnpm build
pnpm test
```

## How the gate runs in CI

Each example commits its `url-contract.json`. On a pull request, the workflow in
[`.github/workflows/examples.yml`](.github/workflows/examples.yml):

1. Re-extracts the contract and fails if the committed file is stale.
2. Compares the contract on the base branch with the one in the pull request.
3. Fails if a breaking change has no verified old URL -> new URL example in the example's `url-migrations.mjs`.

## License

MIT
