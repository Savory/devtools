/**
 * Example app that boots Danet, mounts the devtools and serves the dependency
 * graph visualizer. Run with:
 *
 * ```bash
 * deno task start:example
 * # then open http://localhost:3000/_devtools
 * ```
 */

import {
	Controller,
	DanetApplication,
	Delete,
	Get,
	HttpCode,
	Inject,
	Injectable,
	Module,
	Post,
	Put,
	SCOPE,
} from '@danet/core';
import { setupDevtools } from '../mod.ts';

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

	@Delete(':id')
	remove(): string {
		return 'removed';
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
