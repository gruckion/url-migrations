# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0]

First release.

### Added

- `createURLMigration`: ordered, idempotent rules (`rename-key`, `remove-key`, `update-value`, `custom`) with an optional `matches(url)` scope. A `custom` rule can also change the path.
- `url-migrations extract`: scan a Next.js app router project and write a URL contract of routes, search params, types, and allowed values. `--check` fails when the committed contract is out of date.
- `url-migrations diff`: compare two contracts and exit 1 on a breaking change.
- `url-migrations check`: fail unless every breaking change has a verified old URL to new URL example, or a waiver with a reason.
- `url-migrations/contract`: the same features as a library.
- Examples: `examples/basic` and `examples/kitchen-sink`, with a CI gate that runs on pull requests.

[Unreleased]: https://github.com/gruckion/url-migrations/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gruckion/url-migrations/releases/tag/v0.1.0
