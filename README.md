# @danet/devtools

Developer tooling for [Danet](https://danet.land), the NestJS-inspired backend
framework for Deno.

Inspired by [NestJS Devtools](https://docs.nestjs.com/devtools/overview), it
introspects your application and serves interactive tooling you can explore in
the browser, entirely locally (no cloud account, no data leaves your machine):

- a **dependency graph visualizer** — modules, controllers and providers, wired
  by their `import` / `declares` / `injects` relationships;
- a **routes explorer** — every entrypoint your controllers expose (HTTP routes
  _and_ WebSocket handlers), grouped by controller and filterable by path or
  verb. Click an entrypoint to see its execution flow — the middlewares, guards
  and filters bound to it.

![modules → controllers → providers, wired by import / declares / injects edges]

## Install

```ts
// deno.json
{
  "imports": {
    "@danet/core": "jsr:@danet/core@^2.11.0",
    "@danet/devtools": "jsr:@danet/devtools@^0.1.0"
  }
}
```

## Usage

Mount the devtools on your app before listening:

```typescript
import { DanetApplication } from '@danet/core';
import { setupDevtools } from '@danet/devtools';
import { AppModule } from './app.module.ts';

const app = new DanetApplication();
await app.init(AppModule);

setupDevtools(app); // mounts GET /_devtools

await app.listen(3000);
// dependency graph: http://localhost:3000/_devtools
// routes explorer:  http://localhost:3000/_devtools/routes
```

Then open `http://localhost:3000/_devtools` and use the nav to switch between
the **Dependency Graph** and **Routes** views.

### Options

```typescript
setupDevtools(app, { path: '/_devtools' });
```

| Option | Default        | Description                                  |
| ------ | -------------- | -------------------------------------------- |
| `path` | `'/_devtools'` | Base path for the UIs and their JSON routes. |

Four routes are registered:

- `GET {path}` — the interactive dependency graph UI.
- `GET {path}/graph.json` — the raw graph as JSON.
- `GET {path}/routes` — the routes explorer UI.
- `GET {path}/routes.json` — the raw route map as JSON.

> Tip: only call `setupDevtools` in development, e.g.
> `if (Deno.env.get('NODE_ENV') !== 'production') setupDevtools(app);`

## The graph, without the server

You can build the graph yourself (e.g. to snapshot it, diff it in CI, or feed it
to another tool). It's a pure metadata introspection — no app boot required:

```typescript
import { buildDependencyGraph } from '@danet/devtools/graph';
import { AppModule } from './app.module.ts';

const graph = buildDependencyGraph(AppModule);
// { nodes: GraphNode[], edges: GraphEdge[] }
```

### Graph model

- **Nodes** — `module`, `controller`, `provider`. Providers carry their DI
  `scope` (`GLOBAL` / `REQUEST` / `TRANSIENT`) and flags for token-/value-based
  providers.
- **Edges** — `import` (module → module), `declares` (module → controller /
  provider) and `injects` (constructor dependency).

The walk mirrors the framework's own bootstrap: it starts at the entry module,
recurses through `imports`, and reads constructor `design:paramtypes` plus
`@Inject(token)` metadata to discover injection edges.

## The routes, without the server

The route map is likewise pure metadata introspection — handy for snapshotting
your API surface or diffing it in CI:

```typescript
import { buildRouteMap } from '@danet/devtools/routes';
import { AppModule } from './app.module.ts';

const map = buildRouteMap(AppModule, { prefix: '/api' });
// { prefix: '/api', controllers: RouteController[] }
// each route: { method, path, handler, kind, bindings, sse?, statusCode? }
```

It reconstructs the exact path Danet registers for every handler — controller
base path + method path + optional global prefix — and reports the HTTP verb
(`@All` handlers surface as `ALL`), `@SSE` streams and `@HttpCode` status codes.
Pass `prefix` to match an app-wide base path set with `app.registerBasePath`
(`setupDevtools` wires this automatically).

It also captures, per entrypoint:

- **`kind`** — `'http'` or `'ws'`. WebSocket controllers
  (`@WebSocketController`) and their `@OnWebSocketMessage` topics are listed
  alongside HTTP routes.
- **`bindings`** — the execution pipeline bound to the route via decorators:
  `@Middleware` middlewares, `@UseGuard` guards and `@UseFilter` filters, each
  tagged with its `stage` and whether it's bound at `controller` or `method`
  scope. (Globally-registered ones live in the injector, not in metadata, so
  they aren't included.)

## Visualizer features

**Dependency graph**

- Color-coded nodes (modules, controllers, providers) with distinct shapes.
- Request-/transient-scoped providers are outlined so non-singletons stand out.
- Click a node to inspect it and highlight its immediate neighborhood.
- Filter nodes, switch layouts (force / hierarchy / concentric / grid), fit.

**Routes explorer**

- Every entrypoint grouped by controller, showing its declaring module and base
  path; HTTP routes and WebSocket handlers side by side.
- Verb-colored badges; path parameters (`:id`) highlighted.
- Live filtering by path/handler text and by HTTP method (or `WS`).
- `SSE` and custom status-code tags surfaced inline.
- Click an entrypoint to see its **execution-flow graph**:
  `Middlewares → Guards → Handler → Filters`, with controller-/method-scope
  bindings labelled — handy for understanding the request lifecycle or
  troubleshooting why a guard/filter isn't running.

## Development

```bash
deno task test          # run the test suite
deno task start:example # boot the example app + devtools on :3000
deno fmt && deno lint   # format & lint
```

## License

MIT
