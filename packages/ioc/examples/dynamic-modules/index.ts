import "reflect-metadata";
import { Inject, Injectable, Module, NexusApplication } from "@nexus-ioc/core";
import type { DynamicModule } from "@nexus-ioc/core";

interface DatabaseConfig {
	host: string;
	port: number;
}

@Injectable()
class DatabaseService {
	constructor(
		@Inject("DATABASE_CONFIG") private readonly config: DatabaseConfig,
	) {}

	getConnection(): string {
		return `${this.config.host}:${this.config.port}`;
	}
}

@Module({})
class DatabaseModule {
	static forRoot(config: DatabaseConfig): DynamicModule {
		return {
			module: DatabaseModule,
			providers: [
				{ provide: "DATABASE_CONFIG", useValue: config },
				DatabaseService,
			],
			exports: [DatabaseService],
		};
	}
}

@Injectable()
class AppService {
	constructor(
		@Inject(DatabaseService) private readonly db: DatabaseService,
	) {}

	run(): void {
		console.log("Connected to:", this.db.getConnection());
	}
}

@Module({
	imports: [DatabaseModule.forRoot({ host: "localhost", port: 5432 })],
	providers: [AppService],
})
class AppModule {}

async function main() {
	const app = await NexusApplication.create(AppModule).bootstrap();
	const service = await app.get<AppService>(AppService);
	service?.run(); // Connected to: localhost:5432
	await app.close();
}

main();
