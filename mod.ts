/**
 * @module
 * `@danet/devtools` — developer tooling for {@link https://danet.land | Danet}.
 *
 * The first feature is a **dependency graph visualizer**, inspired by NestJS
 * Devtools. It introspects your application's modules, controllers and providers
 * and serves an interactive graph you can explore in the browser.
 *
 * @example
 * ```typescript
 * import { DanetApplication } from '@danet/core';
 * import { setupDevtools } from '@danet/devtools';
 * import { AppModule } from './app.module.ts';
 *
 * const app = new DanetApplication();
 * await app.init(AppModule);
 * setupDevtools(app); // mounts GET /_devtools
 * await app.listen(3000);
 * ```
 */

export * from './src/graph/mod.ts';
export * from './src/routes/mod.ts';
export * from './src/server/mod.ts';
