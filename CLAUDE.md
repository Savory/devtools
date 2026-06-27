# CLAUDE.md

Guidance for working in the `@danet/devtools` codebase.

## What this is

`@danet/devtools` is developer tooling for [Danet](https://danet.land), the
NestJS-inspired backend framework for **Deno**, inspired by
[NestJS Devtools](https://docs.nestjs.com/devtools/overview). It introspects a
Danet app and serves interactive tooling in the browser, entirely locally. Two
features today:

- a **dependency graph visualizer** — modules, controllers and providers and
  their `import` / `declares` / `injects` wiring;
- a **routes explorer** — every HTTP route, grouped by controller.

Deno only, published to [JSR](https://jsr.io/@danet/devtools). It depends on
`@danet/core` (peer-style, pulled from JSR).

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

Entry point: `mod.ts` re-exports the subsystems. Public exports are also mapped
in `deno.json` (`.` → `mod.ts`, `./graph` → `src/graph/mod.ts`, `./routes` →
`src/routes/mod.ts`).

The tool has two **extraction** layers (`graph`, `routes`) — pure metadata
walks, framework-agnostic of any server — and one **server** layer serving both.
The two features (dependency graph + routes explorer) share one `setupDevtools`
mount and a cross-linked UI shell.

- **`src/graph/`** — graph extraction, framework-agnostic of any server.
  - `types.ts` — the JSON-serializable data model: `GraphNode` (`module` |
    `controller` | `provider`), `GraphEdge` (`import` | `declares` | `injects`),
    `DependencyGraph`.
  - `builder.ts` — `buildDependencyGraph(entryModule)`. A **pure metadata walk**
    (no app boot): starts at the entry module, recurses through `imports`, and
    reads constructor `design:paramtypes` + `@Inject(token)` metadata to find
    injection edges. Mirrors the logic of `@danet/core`'s `Injector`. Also owns
    the shared `ModuleInput` entry-point type (reused by the routes builder).
  - `mod.ts` — barrel.
- **`src/routes/`** — route-map extraction, also a pure metadata walk.
  - `types.ts` — the data model: `RouteInfo` (`method`, `path`, `handler`,
    optional `sse` / `statusCode`), `RouteController` (groups a controller's
    routes + its declaring `module` and base `prefix`), `RouteMap`.
  - `builder.ts` — `buildRouteMap(entryModule, { prefix })`. Walks modules,
    reads each controller's `endpoint` metadata and each handler's `endpoint` /
    `method` / `SSE` / `status` metadata, and **reconstructs the exact path**
    `DanetHTTPRouter.createRoute` would register (`trimSlash` join + optional
    global prefix). A handler counts as a route only if it carries `endpoint` or
    `method` metadata, so lifecycle hooks / helpers are skipped.
  - `mod.ts` — barrel.
- **`src/server/`** — the HTTP-served visualizers.
  - `devtools.ts` — `setupDevtools(app, { path })`. Registers **four** routes on
    the underlying Hono router (`app.router`): `GET {path}` (graph UI),
    `GET {path}/graph.json`, `GET {path}/routes` (routes UI),
    `GET {path}/routes.json`. Default path `/_devtools`. Both the graph and
    route map are built **lazily per request** from `app.entryModule`, so call
    order vs `app.init` doesn't matter (just call before `app.listen`). The
    route map reads the global prefix from `app.httpRouter.prefix`.
  - `ui.ts` — `renderUI(basePath)`: the graph page (Cytoscape.js from a CDN).
  - `routes-ui.ts` — `renderRoutesUI(basePath)`: the routes explorer page — a
    controller-grouped, filterable (by text + HTTP verb) table. No CDN deps.
  - Both pages are self-contained HTML strings with inlined styles/interactions
    (no build step) and a shared nav linking the two views.
  - `mod.ts` — barrel.

### How the metadata read works

The builder reads the same `reflect-metadata` (`@dx/reflect`, global) that the
framework writes via decorators. It uses `@danet/core`'s exported
`MetadataHelper` (from `@danet/core/metadata`) plus the metadata-key constants
(`moduleMetadataKey`, `injectionData`, `getInjectionTokenMetadataKey`) — never
import `@dx/reflect` directly, so the same registry is shared. Local structural
types (`Ctor`, provider shapes) keep the builder decoupled from the exact
exported `@danet/core` types.

The routes builder reads the same way, but the controller/method routing keys
(`'endpoint'`, `'method'`, `'SSE'`, `'status'`) are **plain string literals** in
`@danet/core` (not exported constants), so they're read as literals through
`MetadataHelper` — exactly as the framework's own router reads them.

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
- `spec/routes-builder.test.ts` — unit-tests `buildRouteMap` against in-file
  fixtures, asserting reconstructed paths, verbs (incl. `@All`/`@SSE`),
  `@HttpCode` status, the global-prefix option, and that non-route methods are
  skipped.
- `spec/devtools.test.ts` — boots a real `DanetApplication`, calls
  `setupDevtools`, `app.listen(0)`, hits the routes over `fetch`, then
  `app.close()`. Follow this pattern (random port, always clean up).

### Danet DI gotcha (bites the example/tests)

In a module's `injectables` array, a token/value provider (`{ token, useValue }`
or `{ token, useClass }`) must be listed **before** any injectable that
`@Inject(token)`s it — otherwise `app.init` throws a `TypeError` from
`@dx/reflect`. This is a `@danet/core` resolution-order constraint, not a
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
JSR dashboard) and the `version` in `deno.json` bumped per release
(`deno
publish` fails if the version already exists on JSR).
