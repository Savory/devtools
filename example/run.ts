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
	Get,
	Inject,
	Injectable,
	Module,
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

const { path } = setupDevtools(app);

let port = Number(Deno.env.get('PORT'));
if (isNaN(port)) {
	port = 3000;
}
await app.listen(port);
console.log(`Devtools available at http://localhost:${port}${path}`);
