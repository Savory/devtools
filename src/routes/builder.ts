/**
 * @module
 * Builds a {@link RouteMap} from a Danet application by introspecting the
 * decorator metadata that `@danet/core` stashes on controllers and their
 * methods.
 *
 * The walk mirrors the framework's own routers (see `DanetHTTPRouter` and
 * `WebSocketRouter` in `@danet/core`): it starts from the entry module, recurses
 * through `imports`, and for every controller reads the routing metadata of each
 * handler to reconstruct the exact paths Danet would register, plus the
 * execution pipeline (middlewares, guards, filters) bound to each. No
 * application boot is required — the map reflects the declared routing, so it
 * can be produced before or after `app.init`.
 */

import { MetadataHelper } from '@danet/core/metadata';
import { moduleMetadataKey } from '@danet/core';
import type { ModuleInput } from '../graph/builder.ts';
import {
	BindingScope,
	EntrypointMethod,
	RouteBinding,
	RouteController,
	RouteInfo,
	RouteKind,
	RouteMap,
} from './types.ts';

// Minimal structural types — kept local so the builder stays decoupled from the
// exact shape of `@danet/core`'s exported types (mirrors the graph builder). The
// public `ModuleInput` entry type is shared with the graph builder.
// deno-lint-ignore no-explicit-any
type Ctor = new (...args: any[]) => any;
// deno-lint-ignore no-explicit-any
type Named = { name?: string } | ((...args: any[]) => unknown);

interface RawModuleMeta {
	imports?: Array<Ctor | DynamicModuleLike>;
	controllers?: Ctor[];
}
interface DynamicModuleLike extends RawModuleMeta {
	module: Ctor;
}

/**
 * Options for {@link buildRouteMap}.
 */
export interface BuildRouteMapOptions {
	/**
	 * The application-wide path prefix (as set via `app.registerBasePath`), so
	 * the reconstructed HTTP paths match what Danet actually serves. Defaults to
	 * `''`.
	 */
	prefix?: string;
}

// Metadata keys written by `@danet/core`'s decorators. Some (guard/filter/
// middleware) are exported constants in the framework, but — like the router's
// own `'endpoint'`/`'method'` keys — they are read here as the same plain string
// literals through the shared MetadataHelper registry, exactly as the framework
// reads them.
const ENDPOINT_KEY = 'endpoint';
const METHOD_KEY = 'method';
const SSE_KEY = 'SSE';
const STATUS_KEY = 'status';
const WS_ENDPOINT_KEY = 'websocket-endpoint';
const WS_TOPIC_KEY = 'websocket-topic';
const GUARD_KEY = 'authGuards';
const FILTER_KEY = 'filterException';
const MIDDLEWARE_KEY = 'middlewares';

function nameOf(ctor: Ctor | undefined): string {
	return ctor?.name || 'Anonymous';
}

function bindingName(value: Named | undefined): string {
	return (typeof value === 'function' ? value.name : value?.name) ||
		'Anonymous';
}

function isDynamicModule(mod: ModuleInput): mod is DynamicModuleLike {
	return typeof mod === 'object' && mod !== null && 'module' in mod;
}

/** Strip a single leading and trailing slash, mirroring `@danet/core`. */
function trimSlash(path: string): string {
	if (path[path.length - 1] === '/') path = path.slice(0, -1);
	if (path[0] === '/') path = path.slice(1);
	return path;
}

/**
 * Stateful helper that accumulates controllers while walking the module tree.
 * One instance per {@link buildRouteMap} call.
 */
class RouteMapBuilder {
	private controllers: RouteController[] = [];
	private visitedModules = new Set<Ctor>();
	private seenControllers = new Set<Ctor>();

	constructor(private readonly prefix: string) {}

	build(entry: ModuleInput): RouteMap {
		this.walkModule(entry);
		return { prefix: this.prefix, controllers: this.controllers };
	}

	private resolveModuleDecl(
		mod: ModuleInput,
	): { ctor: Ctor; imports: ModuleInput[]; controllers: Ctor[] } {
		if (isDynamicModule(mod)) {
			return {
				ctor: mod.module,
				imports: mod.imports ?? [],
				controllers: mod.controllers ?? [],
			};
		}
		const meta = MetadataHelper.getMetadata<RawModuleMeta>(
			moduleMetadataKey,
			mod,
		) ?? {};
		return {
			ctor: mod,
			imports: meta.imports ?? [],
			controllers: meta.controllers ?? [],
		};
	}

	private walkModule(mod: ModuleInput): void {
		const { ctor, imports, controllers } = this.resolveModuleDecl(mod);

		if (this.visitedModules.has(ctor)) return;
		this.visitedModules.add(ctor);

		const moduleName = nameOf(ctor);
		for (const controller of controllers) {
			this.addController(controller, moduleName);
		}

		for (const imported of imports) {
			this.walkModule(imported);
		}
	}

	private addController(controller: Ctor, moduleName: string): void {
		// A controller can be declared by several modules; only map it once.
		if (this.seenControllers.has(controller)) return;
		this.seenControllers.add(controller);

		const wsEndpoint = MetadataHelper.getMetadata<string>(
			WS_ENDPOINT_KEY,
			controller,
		);
		const kind: RouteKind = wsEndpoint !== undefined ? 'ws' : 'http';
		const base = trimSlash(
			(kind === 'ws'
				? wsEndpoint
				: MetadataHelper.getMetadata<string>(ENDPOINT_KEY, controller)) ?? '',
		);

		const controllerBindings = this.bindingsOf(controller, 'controller');

		const routes: RouteInfo[] = [];
		const proto = controller.prototype;
		for (const handler of Object.getOwnPropertyNames(proto)) {
			if (handler === 'constructor') continue;
			// deno-lint-ignore no-explicit-any
			const fn = (proto as any)[handler];
			if (typeof fn !== 'function') continue;

			const route = kind === 'ws'
				? this.wsRoute(fn, handler)
				: this.httpRoute(fn, handler, base);
			if (!route) continue;

			route.bindings = [
				...controllerBindings,
				...this.bindingsOf(fn, 'method'),
			];
			routes.push(route);
		}

		this.controllers.push({
			controller: nameOf(controller),
			kind,
			prefix: base,
			module: moduleName,
			routes,
		});
	}

	private httpRoute(
		fn: Named,
		handler: string,
		base: string,
	): RouteInfo | undefined {
		const endpoint = MetadataHelper.getMetadata<string>(ENDPOINT_KEY, fn);
		const method = MetadataHelper.getMetadata<string>(METHOD_KEY, fn);
		// A method is a route only if it carries routing metadata; this skips
		// lifecycle hooks and plain helper methods on the controller.
		if (endpoint === undefined && method === undefined) return undefined;

		const status = MetadataHelper.getMetadata<number>(STATUS_KEY, fn);
		return {
			method: (method ?? 'ALL') as EntrypointMethod,
			path: this.buildPath(base, trimSlash(endpoint ?? '')),
			handler,
			kind: 'http',
			bindings: [],
			...(MetadataHelper.getMetadata<boolean>(SSE_KEY, fn)
				? { sse: true }
				: {}),
			...(typeof status === 'number' ? { statusCode: status } : {}),
		};
	}

	private wsRoute(fn: Named, handler: string): RouteInfo | undefined {
		const topic = MetadataHelper.getMetadata<string>(WS_TOPIC_KEY, fn);
		if (topic === undefined) return undefined;
		return {
			method: 'WS',
			path: topic,
			handler,
			kind: 'ws',
			bindings: [],
		};
	}

	/** Read the middleware/guard/filter bindings declared on a target. */
	private bindingsOf(target: object, scope: BindingScope): RouteBinding[] {
		const bindings: RouteBinding[] = [];

		const middlewares = MetadataHelper.getMetadata<Named[]>(
			MIDDLEWARE_KEY,
			target,
		);
		for (const mw of middlewares ?? []) {
			bindings.push({ name: bindingName(mw), stage: 'middleware', scope });
		}

		const guard = MetadataHelper.getMetadata<Named>(GUARD_KEY, target);
		if (guard) {
			bindings.push({ name: bindingName(guard), stage: 'guard', scope });
		}

		const filter = MetadataHelper.getMetadata<Named>(FILTER_KEY, target);
		if (filter) {
			bindings.push({ name: bindingName(filter), stage: 'filter', scope });
		}

		return bindings;
	}

	/** Assemble a full path the same way `DanetHTTPRouter.createRoute` does. */
	private buildPath(base: string, endpoint: string): string {
		const path = (base ? '/' + base : '') + (endpoint ? '/' + endpoint : '');
		return `${this.prefix}${path || '/'}`;
	}
}

/**
 * Build the route map of a Danet application.
 *
 * @param entryModule The application's root `@Module` class (typically
 * `app.entryModule`), or a dynamic module object.
 * @param options See {@link BuildRouteMapOptions}.
 * @returns A JSON-serializable {@link RouteMap} grouped by controller.
 *
 * @example
 * ```typescript
 * import { buildRouteMap } from '@danet/devtools/routes';
 *
 * const app = new DanetApplication();
 * await app.init(AppModule);
 * const map = buildRouteMap(app.entryModule);
 * console.log(map.controllers.flatMap((c) => c.routes).length, 'entrypoints');
 * ```
 */
export function buildRouteMap(
	entryModule: ModuleInput,
	options: BuildRouteMapOptions = {},
): RouteMap {
	return new RouteMapBuilder(options.prefix ?? '').build(entryModule);
}
