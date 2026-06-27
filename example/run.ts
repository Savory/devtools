/**
 * Example app that boots Danet, mounts the devtools and serves both the
 * dependency graph visualizer and the routes explorer. It wires up middleware,
 * a guard, an exception filter and a WebSocket gateway so the routes explorer's
 * execution-flow graph has something to show. Run with:
 *
 * ```bash
 * deno task start:example
 * # then open http://localhost:3000/_devtools
 * ```
 */

import {
	type AuthGuard,
	Catch,
	Controller,
	DanetApplication,
	type DanetMiddleware,
	Delete,
	type ExceptionFilter,
	type ExecutionContext,
	Get,
	HttpCode,
	type HttpContext,
	Inject,
	Injectable,
	Middleware,
	Module,
	type NextFunction,
	OnWebSocketMessage,
	Post,
	Put,
	SCOPE,
	UseFilter,
	UseGuard,
	WebSocketController,
} from '@danet/core';
import { setupDevtools } from '../mod.ts';

class LoggingMiddleware implements DanetMiddleware {
	async action(_ctx: ExecutionContext, next: NextFunction): Promise<void> {
		await next();
	}
}

class ApiKeyGuard implements AuthGuard {
	canActivate(_ctx: ExecutionContext): boolean {
		return true;
	}
}

@Catch(Error)
class HttpExceptionFilter implements ExceptionFilter {
	catch(_error: unknown, ctx: HttpContext): Response {
		return ctx.json({ error: 'Something went wrong' }, 500);
	}
}

@Injectable()
class ConfigService {
	get(key: string): string {
		return `value-of-${key}`;
	}
}

@Injectable()
class DatabaseService {
	constructor(private config: ConfigService) {}
	query(): string {
		return this.config.get('db-url');
	}
}

@Injectable({ scope: SCOPE.REQUEST })
class RequestLogger {
	log(msg: string): void {
		console.log(msg);
	}
}

@Injectable()
class UserService {
	constructor(
		private db: DatabaseService,
		@Inject('CONFIG_TOKEN') private token: string,
	) {}
	findAll(): string {
		return this.db.query();
	}
}

// Controller-level middleware + guard apply to every route below; the method
// level @UseFilter only applies to `remove`.
@Middleware(LoggingMiddleware)
@UseGuard(ApiKeyGuard)
@Controller('users')
class UserController {
	constructor(
		private users: UserService,
		private logger: RequestLogger,
	) {}

	@Get('')
	list(): string {
		this.logger.log('listing users');
		return this.users.findAll();
	}

	@Get(':id')
	getOne(): string {
		return this.users.findAll();
	}

	@Post('')
	@HttpCode(201)
	create(): string {
		return 'created';
	}

	@Put(':id')
	update(): string {
		return 'updated';
	}

	@UseFilter(HttpExceptionFilter)
	@Delete(':id')
	remove(): string {
		return 'removed';
	}
}

@WebSocketController('chat')
class ChatGateway {
	@OnWebSocketMessage('message')
	onMessage(): { topic: string; data: string } {
		return { topic: 'message', data: 'received' };
	}

	@OnWebSocketMessage('typing')
	onTyping(): { topic: string; data: string } {
		return { topic: 'typing', data: 'ack' };
	}
}

@Module({
	injectables: [ConfigService, DatabaseService],
})
class CoreModule {}

@Module({
	imports: [CoreModule],
	controllers: [UserController, ChatGateway],
	injectables: [
		{ token: 'CONFIG_TOKEN', useValue: 'super-secret' },
		UserService,
		RequestLogger,
	],
})
class AppModule {}

const app = new DanetApplication();
await app.init(AppModule);

const { path, routesPath } = setupDevtools(app);

let port = Number(Deno.env.get('PORT'));
if (isNaN(port)) {
	port = 3000;
}
await app.listen(port);
console.log(`Dependency graph at http://localhost:${port}${path}`);
console.log(`Routes explorer  at http://localhost:${port}${routesPath}`);
