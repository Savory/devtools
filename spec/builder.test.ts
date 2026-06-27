import { assert, assertEquals, assertExists } from '@std/assert';
import {
	Controller,
	Get,
	Inject,
	Injectable,
	Module,
	SCOPE,
} from '@danet/core';
import { buildDependencyGraph } from '../src/graph/builder.ts';
import type { DependencyGraph, GraphNode } from '../src/graph/types.ts';

@Injectable()
class ConfigService {}

@Injectable()
class DatabaseService {
	constructor(public config: ConfigService) {}
}

@Injectable({ scope: SCOPE.REQUEST })
class RequestScoped {}

@Injectable()
class UserService {
	constructor(
		public db: DatabaseService,
		@Inject('CONFIG_TOKEN') public token: string,
	) {}
}

@Controller('users')
class UserController {
	constructor(public users: UserService) {}

	@Get('')
	list() {
		return 'ok';
	}
}

@Module({
	injectables: [ConfigService, DatabaseService],
})
class CoreModule {}

@Module({
	imports: [CoreModule],
	controllers: [UserController],
	injectables: [
		UserService,
		RequestScoped,
		{ token: 'CONFIG_TOKEN', useValue: 'secret' },
	],
})
class AppModule {}

function nodeByLabel(graph: DependencyGraph, label: string): GraphNode {
	const node = graph.nodes.find((n) => n.label === label);
	assertExists(node, `expected a node labelled "${label}"`);
	return node;
}

function hasEdge(
	graph: DependencyGraph,
	sourceLabel: string,
	targetLabel: string,
	kind: string,
): boolean {
	const source = nodeByLabel(graph, sourceLabel).id;
	const target = nodeByLabel(graph, targetLabel).id;
	return graph.edges.some((e) =>
		e.source === source && e.target === target && e.kind === kind
	);
}

Deno.test('buildDependencyGraph', async (t) => {
	const graph = buildDependencyGraph(AppModule);

	await t.step('registers all modules', () => {
		const modules = graph.nodes.filter((n) => n.kind === 'module');
		assertEquals(modules.map((m) => m.label).sort(), [
			'AppModule',
			'CoreModule',
		]);
	});

	await t.step('registers controllers and providers', () => {
		assertEquals(nodeByLabel(graph, 'UserController').kind, 'controller');
		assertEquals(nodeByLabel(graph, 'UserService').kind, 'provider');
		assertEquals(nodeByLabel(graph, 'ConfigService').kind, 'provider');
	});

	await t.step('captures module imports', () => {
		assert(hasEdge(graph, 'AppModule', 'CoreModule', 'import'));
	});

	await t.step('captures declares edges', () => {
		assert(hasEdge(graph, 'AppModule', 'UserController', 'declares'));
		assert(hasEdge(graph, 'CoreModule', 'ConfigService', 'declares'));
	});

	await t.step('captures constructor injection edges', () => {
		assert(hasEdge(graph, 'UserController', 'UserService', 'injects'));
		assert(hasEdge(graph, 'UserService', 'DatabaseService', 'injects'));
		assert(hasEdge(graph, 'DatabaseService', 'ConfigService', 'injects'));
	});

	await t.step('resolves token-based injection across modules', () => {
		// UserService injects the value provider registered under CONFIG_TOKEN.
		assert(hasEdge(graph, 'UserService', 'CONFIG_TOKEN', 'injects'));
		const token = nodeByLabel(graph, 'CONFIG_TOKEN');
		assertEquals(token.kind, 'provider');
		assertEquals(token.tokenBased, true);
		assertEquals(token.valueBased, true);
	});

	await t.step('records provider scope', () => {
		assertEquals(nodeByLabel(graph, 'ConfigService').scope, SCOPE.GLOBAL);
		assertEquals(nodeByLabel(graph, 'RequestScoped').scope, SCOPE.REQUEST);
	});

	await t.step('produces no dangling edges', () => {
		const ids = new Set(graph.nodes.map((n) => n.id));
		for (const edge of graph.edges) {
			assert(ids.has(edge.source), `dangling source ${edge.source}`);
			assert(ids.has(edge.target), `dangling target ${edge.target}`);
		}
	});
});
