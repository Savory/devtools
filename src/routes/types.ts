/**
 * @module
 * Serializable data model describing the HTTP routes a Danet application
 * exposes.
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
export type RouteMethod =
	| 'GET'
	| 'POST'
	| 'PUT'
	| 'PATCH'
	| 'DELETE'
	| 'OPTIONS'
	| 'HEAD'
	| 'ALL';

/**
 * A single HTTP route exposed by a controller method.
 */
export interface RouteInfo {
	/** The HTTP verb the route responds to (`ALL` for `@All()` handlers). */
	method: RouteMethod;
	/**
	 * The full path the route is registered at, including the global prefix and
	 * the controller's base path, e.g. `/api/users/:id`.
	 */
	path: string;
	/** The name of the controller method that handles the route. */
	handler: string;
	/** `true` when the handler streams Server-Sent Events (`@SSE`). */
	sse?: boolean;
	/** Custom success status code declared with `@HttpCode`, when set. */
	statusCode?: number;
}

/**
 * A controller and the routes it declares.
 */
export interface RouteController {
	/** The controller class name. */
	controller: string;
	/**
	 * The controller's base path, trimmed of surrounding slashes (`''` when the
	 * controller has no base path).
	 */
	prefix: string;
	/** The name of the module that declares this controller. */
	module: string;
	/** The routes the controller exposes, in declaration order. */
	routes: RouteInfo[];
}

/**
 * The complete set of HTTP routes of a Danet application, grouped by controller.
 */
export interface RouteMap {
	/**
	 * The application-wide path prefix (from `app.registerBasePath`), or `''`
	 * when none is set.
	 */
	prefix: string;
	/** The application's controllers and their routes. */
	controllers: RouteController[];
}
