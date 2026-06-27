/**
 * @module
 * Serializable data model describing the entrypoints a Danet application
 * exposes — HTTP routes and WebSocket message handlers — together with the
 * execution pipeline (middlewares, guards, filters) bound to each.
 *
 * The map is produced by {@link buildRouteMap} and consumed by the devtools
 * routes explorer UI. Like the dependency graph, it is intentionally
 * JSON-friendly (no class references, no cycles) so it can be sent over HTTP and
 * rendered in a browser.
 */

/**
 * An HTTP verb a route responds to.
 *
 * Mirrors `@danet/core`'s `HttpMethod`, plus `ALL` for handlers registered with
 * the `@All()` decorator (which match every verb).
 */
export type HttpVerb =
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'DELETE'
	| 'OPTIONS'
	| 'HEAD'
	| 'ALL';

/**
 * The verb-like label shown for an entrypoint: an {@link HttpVerb} for HTTP
 * routes, or `WS` for a WebSocket message handler.
 */
export type EntrypointMethod = HttpVerb | 'WS';

/**
 * Whether an entrypoint is an HTTP route or a WebSocket message handler.
 */
export type RouteKind = 'http' | 'ws';

/**
 * A stage of the request execution pipeline a binding belongs to.
 *
 * Danet runs them in this order around a handler:
 * `middleware` → `guard` → (handler) → `filter` (on error).
 */
export type PipelineStage = 'middleware' | 'guard' | 'filter';

/**
 * Where a pipeline binding is declared — on the controller class (applies to
 * every route of the controller) or on the individual handler method.
 */
export type BindingScope = 'controller' | 'method';

/**
 * A single element of a route's execution pipeline (a middleware, guard or
 * filter bound to the controller or the handler).
 */
export interface RouteBinding {
	/** Class or function name of the binding. */
	name: string;
	/** Which pipeline stage it runs in. */
	stage: PipelineStage;
	/** Whether it is bound at controller or method level. */
	scope: BindingScope;
}

/**
 * A single entrypoint exposed by a controller method.
 */
export interface RouteInfo {
	/** The HTTP verb, or `WS` for a WebSocket message handler. */
	method: EntrypointMethod;
	/**
	 * For HTTP routes, the full path the route is registered at (including the
	 * global prefix and the controller base path), e.g. `/api/users/:id`. For
	 * WebSocket handlers, the message topic the handler listens to.
	 */
	path: string;
	/** The name of the controller method that handles the entrypoint. */
	handler: string;
	/** Whether this is an HTTP route or a WebSocket handler. */
	kind: RouteKind;
	/**
	 * The execution pipeline bound to this route, ordered by stage
	 * (middlewares, then guards, then filters) and, within a stage,
	 * controller-level before method-level. Empty when nothing is bound.
	 */
	bindings: RouteBinding[];
	/** `true` when the handler streams Server-Sent Events (`@SSE`). */
	sse?: boolean;
	/** Custom success status code declared with `@HttpCode`, when set. */
	statusCode?: number;
}

/**
 * A controller and the entrypoints it declares.
 */
export interface RouteController {
	/** The controller class name. */
	controller: string;
	/** Whether this is an HTTP or a WebSocket controller. */
	kind: RouteKind;
	/**
	 * The controller's base path (HTTP) or connection endpoint (WebSocket),
	 * trimmed of surrounding slashes (`''` when it has none).
	 */
	prefix: string;
	/** The name of the module that declares this controller. */
	module: string;
	/** The entrypoints the controller exposes, in declaration order. */
	routes: RouteInfo[];
}

/**
 * The complete set of entrypoints of a Danet application, grouped by controller.
 */
export interface RouteMap {
	/**
	 * The application-wide path prefix (from `app.registerBasePath`), or `''`
	 * when none is set. Applies to HTTP routes only.
	 */
	prefix: string;
	/** The application's controllers and their entrypoints. */
	controllers: RouteController[];
}
