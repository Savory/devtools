import { assert, assertEquals } from '@std/assert';
import {
	All,
	Controller,
	Delete,
	Get,
	HttpCode,
	Injectable,
	Module,
	Post,
	SSE,
} from '@danet/core';
import { buildRouteMap } from '../mod.ts';
import type { RouteInfo } from '../src/routes/mod.ts';

@Injectable()
class CatService {
	all(): string {
		return 'cats';
	}
}

@Controller('cats')
class CatController {
	constructor(public cats: CatService) {}

	@Get('')
	list(): string {
		return this.cats.all();
	}

	@Get(':id')
	getOne(): string {
		return 'one';
	}

	@Post('')
	@HttpCode(201)
	create(): string {
		return 'created';
	}

	@Delete(':id')
	remove(): string {
		return 'removed';
	}

	// Not a route — no routing metadata, must be ignored.
	private helper(): string {
		return 'noop';
	}
}

@Controller('')
class RootController {
	@All('health')
	health(): string {
		return 'ok';
	}

	@SSE('stream')
	stream(): EventTarget {
		return new EventTarget();
	}
}

@Module({
	controllers: [CatController],
	injectables: [CatService],
})
class CatModule {}

@Module({
	imports: [CatModule],
	controllers: [RootController],
})
class AppModule {}

function routeOf(
	map: ReturnType<typeof buildRouteMap>,
	controller: string,
	handler: string,
): RouteInfo {
	const c = map.controllers.find((c) => c.controller === controller);
	assert(c, `controller ${controller} not found`);
	const r = c.routes.find((r) => r.handler === handler);
	assert(r, `handler ${handler} not found on ${controller}`);
	return r;
}

Deno.test('buildRouteMap reconstructs controller paths and verbs', () => {
	const map = buildRouteMap(AppModule);

	assertEquals(map.prefix, '');
	assertEquals(map.controllers.length, 2);

	assertEquals(routeOf(map, 'CatController', 'list').path, '/cats');
	assertEquals(routeOf(map, 'CatController', 'list').method, 'GET');
	assertEquals(routeOf(map, 'CatController', 'getOne').path, '/cats/:id');
	assertEquals(routeOf(map, 'CatController', 'remove').method, 'DELETE');
});

Deno.test('buildRouteMap captures HttpCode status', () => {
	const map = buildRouteMap(AppModule);
	const create = routeOf(map, 'CatController', 'create');
	assertEquals(create.method, 'POST');
	assertEquals(create.statusCode, 201);
});

Deno.test('buildRouteMap ignores non-route methods', () => {
	const map = buildRouteMap(AppModule);
	const cat = map.controllers.find((c) => c.controller === 'CatController')!;
	assert(!cat.routes.some((r) => r.handler === 'helper'));
	assertEquals(cat.routes.length, 4);
});

Deno.test('buildRouteMap handles @All (ALL verb) and @SSE', () => {
	const map = buildRouteMap(AppModule);
	const health = routeOf(map, 'RootController', 'health');
	assertEquals(health.method, 'ALL');
	assertEquals(health.path, '/health');

	const stream = routeOf(map, 'RootController', 'stream');
	assertEquals(stream.method, 'GET');
	assertEquals(stream.sse, true);
	assertEquals(stream.path, '/stream');
});

Deno.test('buildRouteMap records the declaring module and controller prefix', () => {
	const map = buildRouteMap(AppModule);
	const cat = map.controllers.find((c) => c.controller === 'CatController')!;
	assertEquals(cat.module, 'CatModule');
	assertEquals(cat.prefix, 'cats');

	const root = map.controllers.find((c) => c.controller === 'RootController')!;
	assertEquals(root.module, 'AppModule');
	assertEquals(root.prefix, '');
});

Deno.test('buildRouteMap applies a global prefix to every path', () => {
	const map = buildRouteMap(AppModule, { prefix: '/api' });
	assertEquals(map.prefix, '/api');
	assertEquals(routeOf(map, 'CatController', 'list').path, '/api/cats');
	assertEquals(routeOf(map, 'CatController', 'getOne').path, '/api/cats/:id');
	assertEquals(routeOf(map, 'RootController', 'health').path, '/api/health');
});
