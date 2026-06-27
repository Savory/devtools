/**
 * @module
 * Builds a {@link DependencyGraph} from a Danet application by introspecting the
 * decorator metadata that `@danet/core` stashes on modules, controllers and
 * providers.
 *
 * The walk mirrors the framework's own bootstrap logic (see `Injector` in
 * `@danet/core`): it starts from the entry module, recurses through `imports`,
 * and reads constructor `design:paramtypes` (plus `@Inject` tokens) to discover
 * the injection edges. No application boot is required — the graph reflects the
 * declared wiring, so it can be produced before or after `app.init`.
 */

import { MetadataHelper } from '@danet/core/metadata';
import {
	getInjectionTokenMetadataKey,
	injectionData,
	moduleMetadataKey,
} from '@danet/core';
import {
	DependencyGraph,
	GraphEdge,
	GraphNode,
	NodeKind,
	NodeScope,
} from './types.ts';

// Minimal structural types — kept local so the builder stays decoupled from the
// exact shape of `@danet/core`'s exported types.
// deno-lint-ignore no-explicit-any
type Ctor = new (...args: any[]) => any;
type Token = string | symbol;

interface UseClassProvider {
	token: Token;
	useClass: Ctor;
}
interface UseValueProvider {
	token: Token;
	useValue: unknown;
}
type ProviderDecl = Ctor | UseClassProvider | UseValueProvider;

interface RawModuleMeta {
	imports?: Array<Ctor | DynamicModuleLike>;
	controllers?: Ctor[];
	injectables?: ProviderDecl[];
}
interface DynamicModuleLike extends RawModuleMeta {
	module: Ctor;
}

/**
 * The accepted entry point: a `@Module`-decorated class or a dynamic module.
 */
export type ModuleInput = Ctor | DynamicModuleLike;

function nameOf(ctor: Ctor | undefined): string {
	return ctor?.name || 'Anonymous';
}

function isDynamicModule(mod: ModuleInput): mod is DynamicModuleLike {
	return typeof mod === 'object' && mod !== null && 'module' in mod;
}

function isTokenProvider(
	decl: ProviderDecl,
): decl is UseClassProvider | UseValueProvider {
	return typeof decl === 'object' && decl !== null && 'token' in decl;
}

/**
 * Stateful helper that accumulates nodes and edges while walking the module
 * tree. One instance per {@link buildDependencyGraph} call.
 */
class GraphBuilder {
	private nodes: GraphNode[] = [];
	private edges: GraphEdge[] = [];
	/** Maps a constructor reference or injection token to its node id. */
	private idByKey = new Map<unknown, string>();
	private usedIds = new Set<string>();
	private edgeKeys = new Set<string>();
	private visitedModules = new Set<Ctor>();
	/** Class-backed nodes whose constructor dependencies still need resolving. */
	private consumers: Array<{ type: Ctor; nodeId: string }> = [];

	build(entry: ModuleInput): DependencyGraph {
		this.walkModule(entry);
		this.resolveInjections();
		return { nodes: this.nodes, edges: this.edges };
	}

	private resolveModuleDecl(mod: ModuleInput): Required<RawModuleMeta> & {
		ctor: Ctor;
	} {
		if (isDynamicModule(mod)) {
			return {
				ctor: mod.module,
				controllers: mod.controllers ?? [],
				imports: mod.imports ?? [],
				injectables: mod.injectables ?? [],
			};
		}
		const meta = MetadataHelper.getMetadata<RawModuleMeta>(
			moduleMetadataKey,
			mod,
		) ?? {};
		return {
			ctor: mod,
			controllers: meta.controllers ?? [],
			imports: meta.imports ?? [],
			injectables: meta.injectables ?? [],
		};
	}

	private walkModule(mod: ModuleInput): string {
		const { ctor, controllers, imports, injectables } = this.resolveModuleDecl(
			mod,
		);

		if (this.visitedModules.has(ctor)) {
			return this.idByKey.get(ctor)!;
		}
		this.visitedModules.add(ctor);

		const moduleId = this.addNode(ctor, nameOf(ctor), 'module');

		for (const imported of imports) {
			const importedId = this.walkModule(imported);
			this.addEdge(moduleId, importedId, 'import');
		}

		for (const decl of injectables) {
			this.addProvider(decl, moduleId);
		}

		for (const controller of controllers) {
			const nodeId = this.addNode(
				controller,
				nameOf(controller),
				'controller',
				{ moduleId },
			);
			this.addEdge(moduleId, nodeId, 'declares');
			this.consumers.push({ type: controller, nodeId });
		}

		return moduleId;
	}

	private addProvider(decl: ProviderDecl, moduleId: string): void {
		if (isTokenProvider(decl)) {
			const label = String(decl.token);
			if ('useValue' in decl) {
				const nodeId = this.addNode(decl.token, label, 'provider', {
					moduleId,
					tokenBased: true,
					valueBased: true,
				});
				this.addEdge(moduleId, nodeId, 'declares');
				return;
			}
			const type = decl.useClass;
			const nodeId = this.addNode(decl.token, label, 'provider', {
				moduleId,
				tokenBased: true,
				scope: this.scopeOf(type),
			});
			this.addEdge(moduleId, nodeId, 'declares');
			this.consumers.push({ type, nodeId });
			return;
		}

		const type = decl;
		const nodeId = this.addNode(type, nameOf(type), 'provider', {
			moduleId,
			scope: this.scopeOf(type),
		});
		this.addEdge(moduleId, nodeId, 'declares');
		this.consumers.push({ type, nodeId });
	}

	private scopeOf(type: Ctor): NodeScope | undefined {
		const meta = MetadataHelper.getMetadata<{ scope?: NodeScope }>(
			injectionData,
			type,
		);
		return meta?.scope;
	}

	private resolveInjections(): void {
		for (const { type, nodeId } of this.consumers) {
			const params = MetadataHelper.getMetadata<Array<Ctor | undefined>>(
				'design:paramtypes',
				type,
			) ?? [];
			params.forEach((paramType, idx) => {
				const token = MetadataHelper.getMetadata<Token | undefined>(
					getInjectionTokenMetadataKey(idx),
					type,
				);
				const key = token ?? paramType;
				if (key === undefined) return;
				const targetId = this.idByKey.get(key);
				if (targetId) {
					this.addEdge(nodeId, targetId, 'injects');
				}
			});
		}
	}

	private addNode(
		key: unknown,
		label: string,
		kind: NodeKind,
		extra: Partial<GraphNode> = {},
	): string {
		const existing = this.idByKey.get(key);
		if (existing) return existing;

		const base = `${kind}:${label}`;
		let id = base;
		let suffix = 2;
		while (this.usedIds.has(id)) {
			id = `${base}#${suffix++}`;
		}
		this.usedIds.add(id);
		this.idByKey.set(key, id);
		this.nodes.push({ id, label, kind, ...extra });
		return id;
	}

	private addEdge(
		source: string,
		target: string,
		kind: GraphEdge['kind'],
	): void {
		const dedupeKey = `${kind}:${source}->${target}`;
		if (this.edgeKeys.has(dedupeKey)) return;
		this.edgeKeys.add(dedupeKey);
		this.edges.push({
			id: `edge-${this.edges.length}`,
			source,
			target,
			kind,
		});
	}
}

/**
 * Build the dependency graph of a Danet application.
 *
 * @param entryModule The application's root `@Module` class (typically
 * `app.entryModule`), or a dynamic module object.
 * @returns A JSON-serializable {@link DependencyGraph}.
 *
 * @example
 * ```typescript
 * import { buildDependencyGraph } from '@danet/devtools/graph';
 *
 * const app = new DanetApplication();
 * await app.init(AppModule);
 * const graph = buildDependencyGraph(app.entryModule);
 * console.log(graph.nodes.length, 'nodes');
 * ```
 */
export function buildDependencyGraph(
	entryModule: ModuleInput,
): DependencyGraph {
	return new GraphBuilder().build(entryModule);
}
