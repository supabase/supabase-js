# supabase-js Expo integration test

An Expo SDK 53 app used as an integration target for `@supabase/supabase-js`. The test suite under `__tests__/` is exercised by:

```bash
nx test:expo supabase-js
```

from the repository root. CI runs it as part of the `integration-tests` workflow against pkg.pr.new preview builds of `@supabase/supabase-js`.

## Local development

```bash
cd packages/core/supabase-js/test/integration/expo
npm install --legacy-peer-deps --ignore-scripts
npm test
```

`--legacy-peer-deps` is required because preview packages are published with version `0.0.0-automated`, which does not satisfy peer-dependency ranges like `^2.76.1`.

## Why jest is pinned to 29 here

The rest of the monorepo runs jest 30 (declared at the workspace root). This subdir pins `jest@29.7.0` directly.

`jest-expo` — at every published version including the current latest `jest-expo@56` — depends on jest 29.x internals: `@jest/globals@^29.2.1`, `@jest/create-cache-key-function@^29.2.1`, `babel-jest@^29.2.1`, `jest-environment-jsdom@^29.2.1`, `jest-snapshot@^29.2.1`. The Expo team has not migrated jest-expo to jest 30 yet.

Without an explicit pin here, `npm install --legacy-peer-deps` lets npm treat the root-hoisted `jest@30` as satisfying `jest-expo`'s optional `jest >=29` peer, so jest is not installed locally. At test time, Node's module resolution then walks up to the root `jest-runtime@30` while `jest-environment-jsdom@29` (a hard dep of jest-expo, installed locally) creates the moduleMocker via `jest-mock@29`. jest 30's runtime calls `_moduleMocker.clearMocksOnScope`, a method that only exists in jest-mock 30 — so CI fails with:

```
TypeError: this._moduleMocker.clearMocksOnScope is not a function
```

Pinning `jest@29.7.0` in this subdir's `package.json` forces npm to install a complete jest 29 toolchain locally (since the root's jest 30 no longer satisfies the explicit `29.7.0` request). Node's lookup from this dir finds the local v29 internals before walking up. Root and every other package keep jest 30; only this expo test runs on jest 29.

**Remove the pin** when jest-expo ships a jest-30-compatible release — at which point this subdir can fall back to whatever the workspace root provides.
