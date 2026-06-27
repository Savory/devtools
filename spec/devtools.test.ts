import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import {
	Controller,
	DanetApplication,
	Get,
	Injectable,
	Module,
} from '@danet/core';
import { setupDevtools } from '../mod.ts';

@Injectable()
class GreetingService {
	hello() {
		return 'hi';
	}
}

@Controller('greet')
class GreetingController {
	constructor(public greeting: GreetingService) {}

	@Get('')
	hello() {
		return this.greeting.hello();
	}
}

@Module({
	controllers: [GreetingController],
	injectables: [GreetingService],
})
class GreetingModule {}

Deno.test('setupDevtools serves UI and graph', async (t) => {
	const app = new DanetApplication();
	await app.init(GreetingModule);
	const handle = setupDevtools(app);
	const { port } = await app.listen(0);
	const base = `http://localhost:${port}`;

	await t.step('returns the resolved paths', () => {
		assertEquals(handle.path, '/_devtools');
		assertEquals(handle.graphPath, '/_devtools/graph.json');
	});

	await t.step('serves the HTML UI', async () => {
		const res = await fetch(`${base}/_devtools`);
		const body = await res.text();
		assertEquals(res.status, 200);
		assertStringIncludes(body, 'Danet Devtools');
		assertStringIncludes(body, '/_devtools/graph.json');
	});

	await t.step('serves the graph JSON', async () => {
		const res = await fetch(`${base}/_devtools/graph.json`);
		const graph = await res.json();
		assertEquals(res.status, 200);
		assert(
			graph.nodes.some((n: { label: string }) =>
				n.label === 'GreetingController'
			),
		);
		assert(graph.edges.length > 0);
	});

	await t.step('returns the resolved routes paths', () => {
		assertEquals(handle.routesPath, '/_devtools/routes');
		assertEquals(handle.routesJsonPath, '/_devtools/routes.json');
	});

	await t.step('serves the routes explorer HTML', async () => {
		const res = await fetch(`${base}/_devtools/routes`);
		const body = await res.text();
		assertEquals(res.status, 200);
		assertStringIncludes(body, 'Danet Devtools');
		assertStringIncludes(body, '/_devtools/routes.json');
	});

	await t.step('serves the route map JSON', async () => {
		const res = await fetch(`${base}/_devtools/routes.json`);
		const map = await res.json();
		assertEquals(res.status, 200);
		const greet = map.controllers.find(
			(c: { controller: string }) => c.controller === 'GreetingController',
		);
		assert(greet, 'GreetingController missing from route map');
		assertEquals(greet.routes[0].method, 'GET');
		assertEquals(greet.routes[0].path, '/greet');
	});

	await app.close();
});

Deno.test('setupDevtools honours a custom path', async () => {
	const app = new DanetApplication();
	await app.init(GreetingModule);
	const handle = setupDevtools(app, { path: '/__graph/' });
	const { port } = await app.listen(0);

	assertEquals(handle.path, '/__graph');
	const res = await fetch(`http://localhost:${port}/__graph`);
	assertEquals(res.status, 200);
	await res.body?.cancel();

	await app.close();
});
