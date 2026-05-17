## Problem

`package.json` declares `react-helmet-async@^3.0.0` (added in the SEO refactor), but `package-lock.json` was never regenerated, so it has zero entries for that package. The GitHub Actions deploy workflow uses `npm ci`, which fails when `package.json` and `package-lock.json` are out of sync.

(`bun.lock` is already in sync — the issue is only the npm lockfile used by CI.)

## Fix

Regenerate `package-lock.json` so it includes `react-helmet-async` and its transitive deps (`invariant`, `react-fast-compare`, `shallowequal`).

Steps:
1. Run `npm install --package-lock-only` to update `package-lock.json` without touching `node_modules`.
2. Verify `react-helmet-async` now appears in `package-lock.json`.
3. Commit the updated lockfile so `npm ci` succeeds on Hostinger deploy.

No source code changes required.
