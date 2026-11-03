# Code quality

## Maintained surfaces and prerequisites

The committed project currently maintains JavaScript ESM in repository tooling, Hardlook helpers, tests, and evaluation tooling.
The starting inventory contains 12 `.mjs` modules and no TypeScript, Java, or maintained Python source.
Native integration directories are reserved for future components; they are not evidence that another language is already maintained.
Plainspoken adds a verbatim upstream-pinned Python linter, not maintained project Python.
Keep that linter, its license, and its invalid fixture byte-identical to their recorded upstream revision rather than running Ruff or another formatter over them.
Plainspoken's maintained JavaScript tests remain covered by ESLint and Prettier, while real Python subprocesses verify the pinned helper's behavior.

Private repository development requires Node 22.13 or later, approved for the supported ESLint 10 toolchain.
Installed Hardlook helpers still require Node 22 or later and Git, without npm runtime dependencies.
No global runtime or settings change is required.
Use `npm ci --ignore-scripts` to materialize the exact development dependencies from `package-lock.json`.

ESLint, its recommended rules, Node globals, Prettier, and the YAML parser used by skill-metadata tests are exact-pinned development dependencies.
ESLint 10 does not support early Node 22 releases; unsupported ESLint 9 is not used to retain that older development floor.
Do not install Java tooling or Ruff without actual maintained source that needs them.
An upstream-pinned Python helper is not maintained project Python merely because it is bundled in a skill.

## Commands

| Command | Contract |
| --- | --- |
| `npm run lint` | Non-mutating ESLint checks; any error or warning fails. |
| `npm run format:check` | Non-mutating Prettier check of JavaScript and TypeScript file extensions. |
| `npm run quality` | Both lint and formatting checks, with failure propagated. |
| `npm run format` | Separate formatting fix for those same extensions; review its diff. |
| `npm run test:quality` | Behavioral tests that invoke the actual npm scripts and tools. |
| `npm test` | Quality and packaging consumers plus both skills' behavior and relocation tests. |

Prettier owns layout: two-space indentation, single quotes, semicolons, LF endings, and a 120-column print width.
ESLint owns correctness and focused design checks rather than competing whitespace rules.
It applies recommended rules, strict comparisons, a nesting-depth limit of four, a callback-depth limit of four, and bans direct or implied `eval`.
Empty catch blocks are allowed for intentionally best-effort cleanup; empty ordinary blocks still fail.
Hardlook's two control-byte validation regexes have narrow, explained rule exceptions because rejecting those bytes is their purpose.

All maintained JavaScript is covered, including helpers beneath `skills/` and executable integration/package sources.
There is no blanket skill-directory exclusion.
CommonJS files receive CommonJS globals; ESM does not silently inherit `require` or `module`.
Prettier can format future TypeScript, but no TypeScript lint/parser coverage is claimed until a component actually introduces and configures it.

## Ownership exclusions

ESLint's global ignores and `.prettierignore` exclude private environment filenames, dependencies, local worktrees/caches, coverage, documented build output locations, and generated `distribution/claude-code/`.
Canonical skill scripts and wrapper/package sources remain checked.
Schemas, Markdown prompts, license notices, and non-JavaScript pinned assets are not selected by the formatting command.
Do not run a broad formatter over upstream byte contracts or hand-edit generated distribution to satisfy a check.

## CI and direct delivery

The existing Linux/macOS workflow runs locked dependency preparation, `npm run quality`, structural checks, and the complete regression suite.
It retains the existing job names and does not create a publication or deployment target.

The user retired the repository's no-mistakes Git proxy and command configuration.
Run the documented npm commands directly, review the intended diff with Hardlook, and use protected GitHub pull requests.
Follow the repository-owned [change delivery policy](../.opencode/instructions/change-delivery.md).
Do not initialize another no-mistakes gate or restore its configuration.
Hardlook's portable optional no-mistakes integration assets remain component functionality, not an active gate for this repository.

## Verification evidence and limits

The tests execute the actual package scripts and npm preparation command in disposable fixtures.
They prove that conforming code passes, undefined names and excessive nesting fail ESLint, formatting drift fails without mutation, and the separate formatter produces the specified output.
They also execute `npm ci --ignore-scripts` with a valid and invalid npm lockfile and verify lifecycle scripts stay disabled.
Generated-output fixtures deliberately contain invalid JavaScript, while maintained-surface fixtures prove those sources remain enforced.
Pinned non-JavaScript fixture bytes must remain unchanged by formatting.

These are executable consumer tests, not assertions that configuration contains tool names.
They do not claim that a formatter proves runtime correctness or that AI review replaces these checks.
Hardlook's own tests and a clean packaged installation verify that development tooling does not become a skill runtime dependency.
