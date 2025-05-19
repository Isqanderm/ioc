import "reflect-metadata";
import { Injectable, Inject, NsModule, type OnModuleInit } from "../src";
import { NexusApplications } from "../src/core/nexus-applications";
import type { HashUtilInterface } from "../src/interfaces";

// Базовый тест инициализации
describe("NexusApplications", () => {
	@Injectable()
	class TestService {
		public initialized = false;
		constructor() {
			this.initialized = true;
		}
	}

	@NsModule({ providers: [TestService] })
	class TestModule {}

	it("should create application and initialize providers", async () => {
		const app = await NexusApplications.create(TestModule).bootstrap();
		const service = await app.get<TestService>(TestService);

		expect(service).toBeInstanceOf(TestService);
		expect(service?.initialized).toBe(true);
	});
});

// Тест зависимостей
describe("Dependency Resolution", () => {
	@Injectable()
	class DatabaseService {
		public connected = true;
	}

	@Injectable()
	class UserService {
		constructor(@Inject(DatabaseService) public database: DatabaseService) {}
	}

	@NsModule({ providers: [DatabaseService, UserService] })
	class AppModule {}

	it("should resolve nested dependencies", async () => {
		const app = await NexusApplications.create(AppModule).bootstrap();
		const userService = await app.get<UserService>(UserService);

		expect(userService?.database).toBeInstanceOf(DatabaseService);
		expect(userService?.database.connected).toBe(true);
	});
});

// Тест жизненного цикла
describe("Lifecycle Hooks", () => {
	const initSpy = jest.fn();

	@Injectable()
	class LifecycleService implements OnModuleInit {
		onModuleInit() {
			initSpy();
		}
	}

	@NsModule({ providers: [LifecycleService] })
	class LifecycleModule {}

	it("should call onModuleInit during bootstrap", async () => {
		const app = await NexusApplications.create(LifecycleModule).bootstrap();
		expect(initSpy).toHaveBeenCalledTimes(1);

		// Повторный вызов get не должен триггерить хук
		await app.get(LifecycleService);
		expect(initSpy).toHaveBeenCalledTimes(1);
	});
});

// Тест кастомного HashUtil
describe("Custom HashUtil", () => {
	class CustomHashUtil implements HashUtilInterface {
		private counter = 0;

		async hashString() {
			return "custom_hash";
		}

		async hashObject() {
			return "object_hash";
		}

		incrementString() {
			return `${this.counter++}`;
		}
	}

	@Injectable()
	class CustomHashService {
		constructor(public hashUtil: HashUtilInterface) {}
	}

	@NsModule({ providers: [CustomHashService] })
	class HashTestModule {}

	it("should use custom hash implementation", async () => {
		const app = NexusApplications.create(HashTestModule, {
			hashFn: CustomHashUtil,
		});
		await app.bootstrap();

		const service = await app.get<CustomHashService>(CustomHashService);
		expect(service?.hashUtil).toBeInstanceOf(CustomHashUtil);
		expect(await service?.hashUtil.hashString("test")).toBe("custom_hash");
	});
});

// Тест обработки ошибок
describe("Error Handling", () => {
	@NsModule({ providers: [] })
	class ErrorModule {}

	it("should throw error for unregistered provider", async () => {
		class UnregisteredService {}

		const app = await NexusApplications.create(ErrorModule).bootstrap();
		await expect(app.get(UnregisteredService)).rejects.toThrow(
			"Provider not found",
		);
	});
});
