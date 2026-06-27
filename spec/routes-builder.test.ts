import { assert, assertEquals } from '@std/assert';
import {
	All,
	type AuthGuard,
	Controller,
	type DanetMiddleware,
	Delete,
	type ExceptionFilter,
	type ExecutionContext,
	Get,
	HttpCode,
	type HttpContext,
	Injectable,
	Middleware,
	Module,
	type NextFunction,
	OnWebSocketMessage,
	Post,
	SSE,
	UseFilter,
	UseGuard,
	WebSocketController,
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

class TraceMiddleware implements DanetMiddleware {
	async action(_ctx: ExecutionContext, next: NextFunction): Promise<void> {
		await next();
	}
}

class RolesGuard implements AuthGuard {
	canActivate(_ctx: ExecutionContext): boolean {
		return true;
	}
}

class ErrorFilter implements ExceptionFilter {
	catch(_error: unknown, _ctx: HttpContext): undefined {
		return undefined;
	}
}

@Middleware(TraceMiddleware)
@UseGuard(RolesGuard)
@Controller('admin')
class AdminController {
	@Get('')
	dashboard(): string {
		return 'dash';
	}

	@UseFilter(ErrorFilter)
	@Delete(':id')
	purge(): string {
		return 'purged';
	}
}

@WebSocketController('chat')
class ChatGateway {
	@OnWebSocketMessage('message')
	onMessage(): { topic: string; data: string } {
		return { topic: 'message', data: 'ok' };
	}

	@OnWebSocketMessage('typing')
	onTyping(): { topic: string; data: string } {
		return { topic: 'typing', data: 'ok' };
	}
}

@Module({
	controllers: [AdminController, ChatGateway],
})
class PipelineModule {}

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

Deno.test('buildRouteMap captures controller- and method-level pipeline bindings', () => {
	const map = buildRouteMap(PipelineModule);

	// Controller-level middleware + guard apply to every route.
	const dashboard = routeOf(map, 'AdminController', 'dashboard');
	assertEquals(dashboard.bindings, [
		{ name: 'TraceMiddleware', stage: 'middleware', scope: 'controller' },
		{ name: 'RolesGuard', stage: 'guard', scope: 'controller' },
	]);

	// The method-level filter is appended after the inherited controller bindings.
	const purge = routeOf(map, 'AdminController', 'purge');
	assertEquals(purge.bindings, [
		{ name: 'TraceMiddleware', stage: 'middleware', scope: 'controller' },
		{ name: 'RolesGuard', stage: 'guard', scope: 'controller' },
		{ name: 'ErrorFilter', stage: 'filter', scope: 'method' },
	]);
});

Deno.test('buildRouteMap maps WebSocket controllers and message topics', () => {
	const map = buildRouteMap(PipelineModule);
	const chat = map.controllers.find((c) => c.controller === 'ChatGateway')!;

	assertEquals(chat.kind, 'ws');
	assertEquals(chat.prefix, 'chat');
	assertEquals(chat.routes.length, 2);

	const message = routeOf(map, 'ChatGateway', 'onMessage');
	assertEquals(message.kind, 'ws');
	assertEquals(message.method, 'WS');
	assertEquals(message.path, 'message');
});

Deno.test('buildRouteMap marks HTTP routes with kind "http"', () => {
	const map = buildRouteMap(AppModule);
	assertEquals(routeOf(map, 'CatController', 'list').kind, 'http');
	const cats = map.controllers.find((c) => c.controller === 'CatController')!;
	assertEquals(cats.kind, 'http');
});
