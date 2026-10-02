# Contributing

Thank you for helping. This guide is short on purpose.

## Set up

You need Node.js 22 and [pnpm](https://pnpm.io) 10.

```sh
pnpm install
pnpm build       # build the package; the examples need it
pnpm typecheck
pnpm test
```

## Layout

| Path                                          | Contents                                                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `packages/url-migrations/src/index.ts`        | `createURLMigration` and the rule types                                                                              |
| `packages/url-migrations/src/contract/`       | The scanner (`extract.ts`), the contract diff (`diff.ts`), URL validation (`validate.ts`), and the gate (`check.ts`) |
| `packages/url-migrations/src/cli-main.ts`     | The CLI commands, as a function that returns its output so tests can call it                                         |
| `packages/url-migrations/fixtures/app-router` | A small Next.js app the scanner tests read                                                                           |
| `examples/*`                                  | Runnable apps. Each has a committed `url-contract.json` and a `url-migrations.mjs`                                   |

## How we work

**Write the test first.** A bug fix starts with a test that fails for the right reason. A feature starts with a test of the behavior you want. The scanner tests read real files in `fixtures/app-router`, so add a file there that shows the case.

**Keep the scanner honest.** If the scanner cannot read a pattern, it must say so (an `opaque` route and a warning). It must never guess and stay quiet. A wrong guess is worse than a missing feature.

**Prefer a failing example to a long explanation.** If you report a scanner miss, a small file that shows it is the best report.

## Typical changes

- **Support a new URL pattern.** Add a fixture file, add a failing test in `extract.test.ts`, then change `extract.ts`.
- **Add a rule type.** Add it to `MigrationAction` in `index.ts`, handle it in the `switch`, and cover it in `index.test.ts`. A new rule must keep `migrate(migrate(url))` equal to `migrate(url)`.
- **Change what counts as breaking.** Change `diff.ts` and add a case to `diff.test.ts`.

## Before you open a pull request

```sh
pnpm build && pnpm typecheck && pnpm test && pnpm format:check
```

If you change a URL in an example, regenerate its contract and commit it:

```sh
pnpm contract
```

CI runs the same checks. It also runs the URL gate on each example, so a breaking change to an example needs a migration and a verified example in its `url-migrations.mjs`.

## Pull requests

- Keep each pull request to one idea.
- Describe what changed and why, in plain words.
- Add a line to `CHANGELOG.md` under "Unreleased" for anything a user would notice.

## Releasing (maintainers)

1. Move the "Unreleased" notes in `CHANGELOG.md` under a new version.
2. Set the same version in `packages/url-migrations/package.json`.
3. Merge to `main`, then publish a GitHub release tagged `v<version>`.

The [release workflow](.github/workflows/release.yml) builds, tests, and publishes to npm with provenance.
