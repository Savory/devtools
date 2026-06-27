# CLAUDE.md

Guidance for working in the `@danet/devtools` codebase.

## What this is

`@danet/devtools` is developer tooling for [Danet](https://danet.land), the
NestJS-inspired backend framework for **Deno**. Its first (and currently only)
feature is a **dependency graph visualizer**, inspired by
[NestJS Devtools](https://docs.nestjs.com/devtools/overview): it introspects a
Danet app's modules, controllers and providers and serves an interactive graph
in the browser, entirely locally. Deno only, published to
[JSR](https://jsr.io/@danet/devtools). It depends on `@danet/core` (peer-style,
pulled from JSR).

## Commands

All tooling is Deno-native (no npm, no Makefile).

```bash
# Run the test suite (same as CI)
deno task test

# Run a single test file
deno test -A --unstable-kv --unstable-cron spec/builder.test.ts

# Lint (CI runs this) — only lints src/, excludes *.test.ts
deno lint

# Format — single quotes, tabs (config in deno.json)
deno fmt

# Boot the example app + devtools on :3000, then open /_devtools
deno task start:example

# Validate the package is publishable to JSR (no slow types, correct exports)
deno publish --dry-run
```

The `test` task expands to
`deno test -A --unstable-kv --unstable-cron spec/**/*.test.ts`. The
`--unstable-kv` / `--unstable-cron` flags are inherited from `@danet/core`'s
needs (booting a `DanetApplication` in the server tests).

## Architecture

Entry point: `mod.ts` re-exports the two subsystems. Public exports are also
mapped in `deno.json` (`.` → `mod.ts`, `./graph` → `src/graph/mod.ts`).

The tool has two cleanly separated layers:

- **`src/graph/`** — graph extraction, framework-agnostic of any server.
  - `types.ts` — the JSON-serializable data model: `GraphNode`
    (`module` | `controller` | `provider`), `GraphEdge`
    (`import` | `declares` | `injects`), `DependencyGraph`.
  - `builder.ts` — `buildDependencyGraph(entryModule)`. A **pure metadata walk**
    (no app boot): starts at the entry module, recurses through `imports`, and
    reads constructor `design:paramtypes` + `@Inject(token)` metadata to find
    injection edges. Mirrors the logic of `@danet/core`'s `Injector`.
  - `mod.ts` — barrel.
- **`src/server/`** — the HTTP-served visualizer.
  - `devtools.ts` — `setupDevtools(app, { path })`. Registers two routes on the
    underlying Hono router (`app.router`): `GET {path}` (UI) and
    `GET {path}/graph.json`. Default path `/_devtools`. The graph is built
    **lazily per request** from `app.entryModule`, so call order vs `app.init`
    doesn't matter (just call before `app.listen`).
  - `ui.ts` — `renderUI(basePath)`: a self-contained HTML page string. Pulls
    Cytoscape.js from a CDN; all styles/interactions are inlined (no build step).
  - `mod.ts` — barrel.

### How the metadata read works

The builder reads the same `reflect-metadata` (`@dx/reflect`, global) that the
framework writes via decorators. It uses `@danet/core`'s exported
`MetadataHelper` (from `@danet/core/metadata`) plus the metadata-key constants
(`moduleMetadataKey`, `injectionData`, `getInjectionTokenMetadataKey`) — never
import `@dx/reflect` directly, so the same registry is shared. Local structural
types (`Ctor`, provider shapes) keep the builder decoupled from the exact
exported `@danet/core` types.

### Conventions

- Per-folder `mod.ts` barrel files (matches the Danet convention).
- Public API carries full JSDoc and **explicit return types** — required so
  `deno publish` passes JSR's "no slow types" check. Keep it that way when
  adding exports; verify with `deno publish --dry-run`.
- The graph model stays JSON-friendly (no class refs, no cycles) so it survives
  the HTTP boundary.

## Testing

Tests live in `spec/` as `*.test.ts` (note: `.test.ts`, **not** `.spec.ts`),
using native `Deno.test` with `@std/assert`. Two styles:

- `spec/builder.test.ts` — unit-tests `buildDependencyGraph` against in-file
  `@Module`/`@Controller`/`@Injectable` fixtures, asserting nodes, edges, scope
  and cross-module/token injection.
- `spec/devtools.test.ts` — boots a real `DanetApplication`, calls
  `setupDevtools`, `app.listen(0)`, hits the routes over `fetch`, then
  `app.close()`. Follow this pattern (random port, always clean up).

### Danet DI gotcha (bites the example/tests)

In a module's `injectables` array, a token/value provider
(`{ token, useValue }` or `{ token, useClass }`) must be listed **before** any
injectable that `@Inject(token)`s it — otherwise `app.init` throws a `TypeError`
from `@dx/reflect`. This is a `@danet/core` resolution-order constraint, not a
devtools bug. The graph builder itself is order-independent.

## Formatting rules (enforced by `deno fmt`)

Single quotes, tabs for indentation. Run `deno fmt` before committing.

## CI & publishing

`.github/workflows/ci.yml` is a single workflow, two jobs:

- `test` (push to `main`, PRs, manual): `deno lint` → `deno task test` →
  `deno publish --dry-run`.
- `publish`: `needs: test` and only on a `main` push — so JSR publish runs
  **only after** lint/tests pass. Uses OIDC (`id-token: write`, no token).

Publishing requires the JSR package to be linked to the GitHub repo (one-time,
JSR dashboard) and the `version` in `deno.json` bumped per release (`deno
publish` fails if the version already exists on JSR).
