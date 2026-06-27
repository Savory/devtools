/**
 * @module
 * Mounts the dependency graph visualizer onto a running Danet application.
 */

import type { DanetApplication } from '@danet/core';
import type { Context } from '@hono/hono';
import { buildDependencyGraph } from '../graph/builder.ts';
import { buildRouteMap } from '../routes/builder.ts';
import { renderUI } from './ui.ts';
import { renderRoutesUI } from './routes-ui.ts';

/**
 * Options for {@link setupDevtools}.
 */
export interface DevtoolsOptions {
	/**
	 * The base path the devtools are served from (no trailing slash).
	 * @default '/_devtools'
	 */
	path?: string;
}

/**
 * Information returned by {@link setupDevtools}.
 */
export interface DevtoolsHandle {
	/** The resolved base path the devtools are mounted at. */
	path: string;
	/** Full path of the JSON graph endpoint. */
	graphPath: string;
	/** Full path of the routes explorer UI. */
	routesPath: string;
	/** Full path of the JSON route map endpoint. */
	routesJsonPath: string;
}

/**
 * Register the devtools routes on a Danet application.
 *
 * Four routes are added on the underlying Hono router:
 * - `GET {path}` — the interactive dependency graph UI.
 * - `GET {path}/graph.json` — the graph as JSON.
 * - `GET {path}/routes` — the routes explorer UI.
 * - `GET {path}/routes.json` — the route map as JSON.
 *
 * Both the graph and the route map are built lazily on each request from
 * `app.entryModule`, so this can be called either before or after `app.init`
 * (the entry module just has to be set by the time the first request comes in).
 * Call it before `app.listen`.
 *
 * @example
 * ```typescript
 * const app = new DanetApplication();
 * await app.init(AppModule);
 * setupDevtools(app);
 * await app.listen(3000);
 * // open http://localhost:3000/_devtools
 * ```
 *
 * @param app The Danet application to instrument.
 * @param options See {@link DevtoolsOptions}.
 * @returns A {@link DevtoolsHandle} describing the mounted routes.
 */
export function setupDevtools(
	app: DanetApplication,
	options: DevtoolsOptions = {},
): DevtoolsHandle {
	const path = normalizePath(options.path ?? '/_devtools');
	const graphPath = `${path}/graph.json`;
	const routesPath = `${path}/routes`;
	const routesJsonPath = `${path}/routes.json`;
	const router = app.router;

	router.get(path, (c: Context) => c.html(renderUI(path)));

	router.get(graphPath, (c: Context) => {
		const entryModule = app.entryModule;
		if (!entryModule) {
			return c.json({
				nodes: [],
				edges: [],
				error: 'Application is not initialized yet (no entry module).',
			});
		}
		return c.json(buildDependencyGraph(entryModule));
	});

	router.get(routesPath, (c: Context) => c.html(renderRoutesUI(path)));

	router.get(routesJsonPath, (c: Context) => {
		const entryModule = app.entryModule;
		if (!entryModule) {
			return c.json({
				prefix: '',
				controllers: [],
				error: 'Application is not initialized yet (no entry module).',
			});
		}
		return c.json(
			buildRouteMap(entryModule, { prefix: app.httpRouter?.prefix ?? '' }),
		);
	});

	return { path, graphPath, routesPath, routesJsonPath };
}

function normalizePath(path: string): string {
	const withLeading = path.startsWith('/') ? path : `/${path}`;
	return withLeading.length > 1 && withLeading.endsWith('/')
		? withLeading.slice(0, -1)
		: withLeading;
}
