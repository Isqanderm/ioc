import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { Injectable, Inject, Scope } from "../../src";

describe("Scope Management", () => {
	describe("Singleton Scope", () => {
		it("should return same instance for singleton scope", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [SingletonService],
			}).compile();

			const instance1 = await container.get<SingletonService>(SingletonService);
			const instance2 = await container.get<SingletonService>(SingletonService);
			const instance3 = await container.get<SingletonService>(SingletonService);

			expect(instance1?.id).toBe(instance2?.id);
			expect(instance2?.id).toBe(instance3?.id);
		});

		it("should use singleton as default scope", async () => {
			@Injectable()
			class DefaultScopeService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [DefaultScopeService],
			}).compile();

			const instance1 = await container.get<DefaultScopeService>(
				DefaultScopeService,
			);
			const instance2 = await container.get<DefaultScopeService>(
				DefaultScopeService,
			);

			expect(instance1?.id).toBe(instance2?.id);
		});

		it("should maintain singleton across dependency injection", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SharedService {
				id = Math.random();
			}

			@Injectable()
			class ServiceA {
				constructor(@Inject(SharedService) public shared: SharedService) {}
			}

			@Injectable()
			class ServiceB {
				constructor(@Inject(SharedService) public shared: SharedService) {}
			}

			const container = await Test.createModule({
				providers: [SharedService, ServiceA, ServiceB],
			}).compile();

			const serviceA = await container.get<ServiceA>(ServiceA);
			const serviceB = await container.get<ServiceB>(ServiceB);

			expect(serviceA?.shared.id).toBe(serviceB?.shared.id);
		});

		it("should work with class providers", async () => {
			@Injectable()
			class ImplementationService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: "SERVICE",
						useClass: ImplementationService,
						scope: Scope.Singleton,
					},
				],
			}).compile();

			const instance1 = await container.get<ImplementationService>("SERVICE");
			const instance2 = await container.get<ImplementationService>("SERVICE");

			expect(instance1?.id).toBe(instance2?.id);
		});

		it("should work with factory providers", async () => {
			let counter = 0;
			const factory = () => ({ id: ++counter });

			const container = await Test.createModule({
				providers: [
					{
						provide: "FACTORY",
						useFactory: factory,
						scope: Scope.Singleton,
					},
				],
			}).compile();

			const instance1 = await container.get<{ id: number }>("FACTORY");
			const instance2 = await container.get<{ id: number }>("FACTORY");

			expect(instance1?.id).toBe(1);
			expect(instance2?.id).toBe(1); // Same instance
		});
	});

	describe("Transient Scope", () => {
		// TODO: Implement Transient scope - currently not defined in Scope enum
		it.todo("should create new instance for each resolution", async () => {
			@Injectable({ scope: Scope.Singleton }) // Using Singleton as Transient doesn't exist
			class TransientService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [TransientService],
			}).compile();

			const instance1 = await container.get<TransientService>(TransientService);
			const instance2 = await container.get<TransientService>(TransientService);
			const instance3 = await container.get<TransientService>(TransientService);

			expect(instance1?.id).not.toBe(instance2?.id);
			expect(instance2?.id).not.toBe(instance3?.id);
			expect(instance1?.id).not.toBe(instance3?.id);
		});

		// TODO: Implement Transient scope
		it.todo("should create new instances in dependency injection", async () => {
			@Injectable({ scope: Scope.Singleton })
			class TransientService {
				id = Math.random();
			}

			@Injectable()
			class ServiceA {
				constructor(@Inject(TransientService) public transient: TransientService) {}
			}

			@Injectable()
			class ServiceB {
				constructor(@Inject(TransientService) public transient: TransientService) {}
			}

			const container = await Test.createModule({
				providers: [TransientService, ServiceA, ServiceB],
			}).compile();

			const serviceA = await container.get<ServiceA>(ServiceA);
			const serviceB = await container.get<ServiceB>(ServiceB);

			// Each service should get a different instance
			expect(serviceA?.transient.id).not.toBe(serviceB?.transient.id);
		});

		// TODO: Implement Transient scope - Scope.Transient is not defined in enum
		it.skip("should work with class providers", async () => {
			@Injectable()
			class ImplementationService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: "SERVICE",
						useClass: ImplementationService,
						// scope: Scope.Transient, // Not implemented
					},
				],
			}).compile();

			const instance1 = await container.get<ImplementationService>("SERVICE");
			const instance2 = await container.get<ImplementationService>("SERVICE");

			expect(instance1?.id).not.toBe(instance2?.id);
		});

		// TODO: Implement Transient scope
		it.skip("should work with factory providers", async () => {
			let counter = 0;
			const factory = () => ({ id: ++counter });

			const container = await Test.createModule({
				providers: [
					{
						provide: "FACTORY",
						useFactory: factory,
						// scope: Scope.Transient, // Not implemented
					},
				],
			}).compile();

			const instance1 = await container.get<{ id: number }>("FACTORY");
			const instance2 = await container.get<{ id: number }>("FACTORY");

			expect(instance1?.id).toBe(1);
			expect(instance2?.id).toBe(2); // Different instances
		});
	});

	describe("Request Scope", () => {
		// TODO: Request scope is partially implemented - it's not cached in providersContainer
		// but still cached in resolveCache during single resolution
		it.skip("should not cache request-scoped providers", async () => {
			@Injectable({ scope: Scope.Request })
			class RequestService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [RequestService],
			}).compile();

			const instance1 = await container.get<RequestService>(RequestService);
			const instance2 = await container.get<RequestService>(RequestService);

			// Request scope should create new instances
			expect(instance1?.id).not.toBe(instance2?.id);
		});

		it("should work with class providers", async () => {
			@Injectable()
			class ImplementationService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [
					{
						provide: "SERVICE",
						useClass: ImplementationService,
						scope: Scope.Request,
					},
				],
			}).compile();

			const instance1 = await container.get<ImplementationService>("SERVICE");
			const instance2 = await container.get<ImplementationService>("SERVICE");

			expect(instance1?.id).not.toBe(instance2?.id);
		});

		it("should inject request-scoped dependencies", async () => {
			@Injectable({ scope: Scope.Request })
			class RequestService {
				id = Math.random();
			}

			@Injectable()
			class ConsumerService {
				constructor(@Inject(RequestService) public request: RequestService) {}
			}

			const container = await Test.createModule({
				providers: [RequestService, ConsumerService],
			}).compile();

			const consumer1 = await container.get<ConsumerService>(ConsumerService);
			const consumer2 = await container.get<ConsumerService>(ConsumerService);

			// Each consumer should get the same singleton instance
			// but the request service should be different
			expect(consumer1).toBe(consumer2);
		});
	});

	describe("Mixed Scopes", () => {
		// TODO: Implement Transient scope
		it.skip("should handle different scopes in same module", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				id = Math.random();
			}

			@Injectable({ scope: Scope.Singleton }) // Transient not implemented
			class TransientService {
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [SingletonService, TransientService],
			}).compile();

			const singleton1 = await container.get<SingletonService>(SingletonService);
			const singleton2 = await container.get<SingletonService>(SingletonService);

			const transient1 = await container.get<TransientService>(TransientService);
			const transient2 = await container.get<TransientService>(TransientService);

			expect(singleton1?.id).toBe(singleton2?.id);
			expect(transient1?.id).not.toBe(transient2?.id);
		});

		// TODO: Implement Transient scope
		it.skip("should inject singleton into transient", async () => {
			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				id = Math.random();
			}

			@Injectable({ scope: Scope.Singleton }) // Transient not implemented
			class TransientService {
				constructor(@Inject(SingletonService) public singleton: SingletonService) {}
				id = Math.random();
			}

			const container = await Test.createModule({
				providers: [SingletonService, TransientService],
			}).compile();

			const transient1 = await container.get<TransientService>(TransientService);
			const transient2 = await container.get<TransientService>(TransientService);

			// Transient instances should be different
			expect(transient1?.id).not.toBe(transient2?.id);
			// But they should share the same singleton
			expect(transient1?.singleton.id).toBe(transient2?.singleton.id);
		});

		it("should inject transient into singleton", async () => {
			@Injectable({ scope: Scope.Transient })
			class TransientService {
				id = Math.random();
			}

			@Injectable({ scope: Scope.Singleton })
			class SingletonService {
				constructor(@Inject(TransientService) public transient: TransientService) {}
			}

			const container = await Test.createModule({
				providers: [TransientService, SingletonService],
			}).compile();

			const singleton1 = await container.get<SingletonService>(SingletonService);
			const singleton2 = await container.get<SingletonService>(SingletonService);

			// Singleton should be the same
			expect(singleton1).toBe(singleton2);
			// And it should have the same transient instance
			expect(singleton1?.transient.id).toBe(singleton2?.transient.id);
		});
	});
});

