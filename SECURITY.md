# Security Policy

## Report a vulnerability

Please do not open a public issue for a security problem.

Use the **Report a vulnerability** button on the [Security tab](https://github.com/gruckion/url-migrations/security/advisories/new) of this repository. This sends a private report to the maintainer.

Include the version, a description, and the steps to reproduce. You can expect a first reply within a week.

## Scope

`url-migrations` rewrites URLs. Report a problem if a migration can send a user to an unintended host (an open redirect), or if the CLI runs code from a file you did not ask it to load. The `check` command loads the module you pass with `--migrations`, so only point it at files you trust.

## Supported versions

Only the latest release gets fixes.
