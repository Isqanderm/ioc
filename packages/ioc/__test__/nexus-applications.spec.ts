import "reflect-metadata";
import { vi } from "vitest";
import {
	Inject,
	Injectable,
	Module,
	NexusApplication,
	type OnModuleInit,
} from "../src";

describe("NexusApplication", () => {
	@Injectable()
	class TestService {
		public initialized = false;
		constructor() {
			this.initialized = true;
		}
	}

	@Module({ providers: [TestService] })
	class TestModule {}

	it("should create application and initialize providers", async () => {
		const app = await NexusApplication.create(TestModule).bootstrap();
		const service = await app.get<TestService>(TestService);

		expect(service).toBeInstanceOf(TestService);
		expect(service?.initialized).toBe(true);
	});
});

describe("Dependency Resolution", () => {
	@Injectable()
	class DatabaseService {
		public connected = true;
	}

	@Injectable()
	class UserService {
		constructor(@Inject(DatabaseService) public database: DatabaseService) {}
	}

	@Module({ providers: [DatabaseService, UserService] })
	class AppModule {}

	it("should resolve nested dependencies", async () => {
		const app = await NexusApplication.create(AppModule).bootstrap();
		const userService = await app.get<UserService>(UserService);

		expect(userService?.database).toBeInstanceOf(DatabaseService);
		expect(userService?.database.connected).toBe(true);
	});
});

describe("Lifecycle Hooks", () => {
	const initSpy = vi.fn();

	@Injectable()
	class LifecycleService implements OnModuleInit {
		onModuleInit() {
			initSpy();
		}
	}

	@Module({ providers: [LifecycleService] })
	class LifecycleModule {}

	it("should call onModuleInit during bootstrap", async () => {
		const app = await NexusApplication.create(LifecycleModule).bootstrap();
		expect(initSpy).toHaveBeenCalledTimes(1);

		// Повторный вызов get не должен триггерить хук
		await app.get(LifecycleService);
		expect(initSpy).toHaveBeenCalledTimes(1);
	});
});
