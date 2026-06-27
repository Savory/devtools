# @danet/devtools

Developer tooling for [Danet](https://danet.land), the NestJS-inspired backend
framework for Deno.

The first feature is a **dependency graph visualizer** — inspired by
[NestJS Devtools](https://docs.nestjs.com/devtools/overview). It introspects
your application's modules, controllers and providers and serves an interactive
graph you can explore in the browser, entirely locally (no cloud account, no
data leaves your machine).

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
// open http://localhost:3000/_devtools
```

Then open `http://localhost:3000/_devtools`.

### Options

```typescript
setupDevtools(app, { path: '/_devtools' });
```

| Option | Default        | Description                                    |
| ------ | -------------- | ---------------------------------------------- |
| `path` | `'/_devtools'` | Base path for the UI and the JSON graph route. |

Two routes are registered:

- `GET {path}` — the interactive graph UI.
- `GET {path}/graph.json` — the raw graph as JSON.

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

## Visualizer features

- Color-coded nodes (modules, controllers, providers) with distinct shapes.
- Request-/transient-scoped providers are outlined so non-singletons stand out.
- Click a node to inspect it and highlight its immediate neighborhood.
- Filter nodes, switch layouts (force / hierarchy / concentric / grid), fit.

## Development

```bash
deno task test          # run the test suite
deno task start:example # boot the example app + devtools on :3000
deno fmt && deno lint   # format & lint
```

## License

MIT
