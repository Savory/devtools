/**
 * @module
 * Serializable data model describing a Danet application's dependency graph.
 *
 * The graph is produced by {@link buildDependencyGraph} and consumed by the
 * devtools UI. It is intentionally JSON-friendly (no class references, no
 * cycles) so it can be sent over HTTP and rendered in a browser.
 */

/**
 * The kind of element a {@link GraphNode} represents.
 *
 * - `module`     — a class decorated with `@Module`.
 * - `controller` — a class decorated with `@Controller` (or a transport controller).
 * - `provider`   — an injectable: a class decorated with `@Injectable`, or a
 *   token-based provider (`useClass` / `useValue`).
 */
export type NodeKind = 'module' | 'controller' | 'provider';

/**
 * The kind of relationship a {@link GraphEdge} represents.
 *
 * - `import`   — a module imports another module.
 * - `declares` — a module declares (owns) a controller or provider.
 * - `injects`  — a controller/provider depends on a provider through its
 *   constructor (constructor injection).
 */
export type EdgeKind = 'import' | 'declares' | 'injects';

/**
 * The DI scope of a provider, mirroring `@danet/core`'s `SCOPE` enum.
 */
export type NodeScope = 'GLOBAL' | 'REQUEST' | 'TRANSIENT';

/**
 * A single vertex of the dependency graph.
 */
export interface GraphNode {
	/** Stable unique identifier, e.g. `provider:UserService`. */
	id: string;
	/** Human-readable name (class name or injection token). */
	label: string;
	/** What this node represents. */
	kind: NodeKind;
	/** Id of the module that declares this node (undefined for modules). */
	moduleId?: string;
	/** DI scope, when the node is a provider. */
	scope?: NodeScope;
	/** `true` when the provider is registered through an injection token. */
	tokenBased?: boolean;
	/** `true` for `useValue` providers (no constructor / no dependencies). */
	valueBased?: boolean;
}

/**
 * A single directed relationship between two {@link GraphNode}s.
 */
export interface GraphEdge {
	/** Stable unique identifier. */
	id: string;
	/** Id of the source node. */
	source: string;
	/** Id of the target node. */
	target: string;
	/** The nature of the relationship. */
	kind: EdgeKind;
}

/**
 * The complete dependency graph of a Danet application.
 */
export interface DependencyGraph {
	nodes: GraphNode[];
	edges: GraphEdge[];
}
