# Worktree dependency reuse

Agent Forge uses npm for its exact-pinned development dependencies.
The bundled skills have no npm runtime dependencies, and Plainspoken's Python helper needs no third-party packages.
There is no compiled dependency output, Python environment, Gradle project, or native application build cache to copy today.

## Setup and normal use

Use Worktrunk v0.81.0 or a compatible release with `pre-start`, `copy-ignored --require-include`, and `--from` support.
Keep Node.js 22.13+ and npm available, plus Python 3.11+ for the normal regression suite.
Seed the primary checkout once:

```sh
npm run deps:prepare
wt switch --create my-change
```

The project-owned `.config/wt.toml` runs preparation in a blocking `pre-start` hook.
Copying and dependency verification finish before Worktrunk launches any `post-start` hook or `--execute` command.
No application, watcher, service, model, or cloud runner is started.
Worktrunk asks for normal project-hook approval; inspect the hook before approving it.
When initially adding this configuration to an older primary checkout, first prepare that checkout after the configuration has merged.
Until then, a missing or different source allowlist disables copying and uses the cold preparation path.

The helper uses Worktrunk's own `wt step copy-ignored --require-include` consumer, without `--force`.
Worktrunk uses isolated reflinks where supported and full copies otherwise, not shared writable dependency symlinks or hardlinks.
Existing unverified destination dependencies are not overwritten by a copy attempt.
For an explicit local refresh, run `npm run deps:prepare` without `--from`.

## Compatibility and cold preparation

Successful locked preparation records a non-secret receipt inside ignored `node_modules/`.
Reuse requires matching source and destination `package.json` and `package-lock.json` hashes, exact Node/npm versions, OS, architecture, Node ABI, and explicit npm target environment settings.
The source's own inputs and its npm-generated installed lock metadata must still match the receipt.
After copying, `npm ls --all --include=dev --offline` checks the installed graph before setup succeeds.
Missing packages or unsafe external symlinks fail setup rather than silently trusting an incomplete or path-bound tree.
Do not run dependency installation concurrently with copying from the same source checkout.
Treat both worktrees as trusted local checkouts; the receipt is compatibility metadata, not a security signature or package-content audit.
Private npm configuration is never read by the helper to discover settings.
The current dependencies are JavaScript-only; adding native modules or new toolchains requires revisiting target/compiler compatibility before extending reuse.

An unseeded source, changed dependency inputs, or incompatible runtime causes a cold `npm ci --ignore-scripts --include=dev --prefer-offline --no-audit --no-fund` preparation.
Lifecycle scripts remain disabled.
The helper uses npm's existing default download cache unless the worktree has a repository-local `.cache/npm/_cacache`.
In that case, npm uses `.cache/npm` and verifies cached package integrity normally.
Only absent package data may require a download; use `NPM_CONFIG_OFFLINE=true npm run deps:prepare` to require an entirely offline preparation and fail clearly on a missing prerequisite.
The original reproducible `npm ci --ignore-scripts` path remains available and is still used by CI.
An installation made outside the helper has no compatibility receipt and must be prepared once before reuse.

## Copy boundary

The root-anchored `.worktreeinclude` selects only:

- `/node_modules/`, provided it contains no local environment, credential configuration, lock/control files, or nested `.cache/`.
- `/.cache/npm/_cacache/content-v2/` and `index-v5/`, npm's content-addressed download data and integrity index.

The helper requires identical explicit source/destination allowlists before invoking the copy consumer.
Incompatible installed dependencies are excluded before copying, while integrity-checked download data can still be reused.
The hook also applies project-owned exclusion patterns and rejects symlinked dependency/cache roots or links escaping the copied subtree.
Worktrunk v0.81 copies ignored directories as units, so nested exclusion patterns alone are insufficient.
The helper inspects filenames and filesystem metadata without reading private contents and refuses a selected subtree containing private/control paths before copying anything.
The regular packaged `node_modules/uri-js/yarn.lock` is explicitly permitted as declarative dependency metadata, not an in-use control lock.
Do not store credentials, user data, runtime databases, transcripts, service ownership records, or validation evidence inside dependency/download directories.

No broad `.cache/`, npm logs, temporary cache files, in-use locks, global authentication stores, `.env` files, local settings, Python virtual environments, build outputs, or retained review/runtime data are allowlisted.
Global npm caches are reused by npm in place, not transferred by Worktrunk.
Never copy a path-bound `.venv`; if Python later acquires packages, retain normal environment creation and consider only its package download cache.

## Inspect and verify

From a fresh owned destination worktree, preview the same compatibility-aware copy without mutation:

```sh
node tooling/worktree-dependencies.mjs --from /path/to/primary --dry-run
```

For the raw copy selection only, `wt step copy-ignored --require-include --dry-run` is available.
The raw command does not perform the helper's compatibility or nested-path safety checks; use the preparation hook to copy and consume dependencies.

```sh
npm run test:worktrunk
npm run quality
npm run check
npm test
npm run build:claude
```

The executable tests use real npm installations offline and, when Worktrunk is installed, real disposable Git worktrees and the native copy consumer.
They verify blocking hook ordering, independent copied files, compatibility rejection, missing allowlists, and exclusion of synthetic private/runtime paths without reading private files.
The general suite reports the native-copy case as skipped on machines without Worktrunk; `test:worktrunk` requires that prerequisite and fails if it is unavailable.
CI retains its existing Linux/macOS cold-install checks rather than downloading a new Worktrunk toolchain.
