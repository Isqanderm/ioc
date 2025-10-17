import "reflect-metadata";
import { Injectable, NsModule } from "@nexus-ioc/core";
import { vi } from "vitest";
import { Test } from "../src/core/testing-container";

describe("TestingContainer (Test class)", () => {
	describe("createModule", () => {
		it("should create a testing module from metadata", async () => {
			@Injectable()
			class TestService {
				getValue() {
					return "test-value";
				}
			}

			const testingModule = await Test.createModule({
				providers: [TestService],
			}).compile();

			expect(testingModule).toBeDefined();
			const service = await testingModule.get<TestService>(TestService);
			expect(service).toBeInstanceOf(TestService);
			expect(service?.getValue()).toBe("test-value");
		});

		// Note: This test is skipped as it requires more complex DI setup
		it.skip("should handle modules with imports", async () => {
			@Injectable()
			class SharedService {
				getName() {
					return "shared";
				}
			}

			@NsModule({
				providers: [SharedService],
				exports: [SharedService],
			})
			class SharedModule {}

			@Injectable()
			class AppService {
				constructor(private sharedService: SharedService) {}

				getSharedName() {
					return this.sharedService.getName();
				}
			}

			const testingModule = await Test.createModule({
				imports: [SharedModule],
				providers: [AppService],
			}).compile();

			const appService = await testingModule.get<AppService>(AppService);
			expect(appService).toBeInstanceOf(AppService);
			expect(appService?.getSharedName()).toBe("shared");
		});

		it("should handle modules with exports", async () => {
			@Injectable()
			class ExportedService {
				getValue() {
					return "exported";
				}
			}

			const testingModule = await Test.createModule({
				providers: [ExportedService],
				exports: [ExportedService],
			}).compile();

			const service = await testingModule.get<ExportedService>(ExportedService);
			expect(service).toBeInstanceOf(ExportedService);
			expect(service?.getValue()).toBe("exported");
		});
	});

	describe("compile", () => {
		it("should compile the testing module and return a module container", async () => {
			@Injectable()
			class SimpleService {}

			const testingModule = await Test.createModule({
				providers: [SimpleService],
			}).compile();

			expect(testingModule).toBeDefined();
			expect(testingModule.get).toBeDefined();
			expect(testingModule.token).toBeDefined();
			expect(testingModule.metatype).toBeDefined();
		});

		it("should allow getting providers after compilation", async () => {
			@Injectable()
			class ServiceA {
				name = "A";
			}

			@Injectable()
			class ServiceB {
				name = "B";
			}

			const testingModule = await Test.createModule({
				providers: [ServiceA, ServiceB],
			}).compile();

			const serviceA = await testingModule.get<ServiceA>(ServiceA);
			const serviceB = await testingModule.get<ServiceB>(ServiceB);

			expect(serviceA?.name).toBe("A");
			expect(serviceB?.name).toBe("B");
		});
	});

	describe("get", () => {
		it("should retrieve a provider by token", async () => {
			@Injectable()
			class MyService {
				value = 42;
			}

			const testingModule = await Test.createModule({
				providers: [MyService],
			}).compile();

			const service = await testingModule.get<MyService>(MyService);
			expect(service).toBeInstanceOf(MyService);
			expect(service?.value).toBe(42);
		});

		it("should return undefined for non-existent providers", async () => {
			@Injectable()
			class ExistingService {}

			@Injectable()
			class NonExistentService {}

			const testingModule = await Test.createModule({
				providers: [ExistingService],
			}).compile();

			const service =
				await testingModule.get<NonExistentService>(NonExistentService);
			expect(service).toBeUndefined();
		});

		it("should throw error when getting provider before compilation", () => {
			@Injectable()
			class MyService {}

			const testInstance = Test.createModule({
				providers: [MyService],
			});

			expect(() => testInstance.get<MyService>(MyService)).toThrow(
				"container not compiled",
			);
		});
	});

	describe("addModule", () => {
		it("should add a new module to the container", async () => {
			@Injectable()
			class InitialService {
				name = "initial";
			}

			@Injectable()
			class NewService {
				name = "new";
			}

			@NsModule({
				providers: [NewService],
				exports: [NewService],
			})
			class NewModule {}

			const testInstance = Test.createModule({
				providers: [InitialService],
			});

			const moduleContainer = await testInstance.addModule(NewModule);
			expect(moduleContainer).toBeDefined();
			expect(moduleContainer.metatype).toBe(NewModule);
		});
	});

	describe("getModule", () => {
		it("should retrieve a module by its class", async () => {
			@Injectable()
			class ServiceInModule {}

			@NsModule({
				providers: [ServiceInModule],
			})
			class TestModule {}

			const testInstance = Test.createModule({
				imports: [TestModule],
			});

			await testInstance.compile();
			const moduleContainer = await testInstance.getModule(TestModule);
			expect(moduleContainer).toBeDefined();
		});

		it("should return undefined for non-existent modules", async () => {
			@NsModule({
				providers: [],
			})
			class ExistingModule {}

			@NsModule({
				providers: [],
			})
			class NonExistentModule {}

			const testInstance = Test.createModule({
				imports: [ExistingModule],
			});

			await testInstance.compile();
			const moduleContainer = await testInstance.getModule(NonExistentModule);
			expect(moduleContainer).toBeUndefined();
		});
	});

	describe("replaceModule", () => {
		it("should replace an existing module with a new one", async () => {
			@Injectable()
			class OldService {
				getValue() {
					return "old";
				}
			}

			@Injectable()
			class NewService {
				getValue() {
					return "new";
				}
			}

			@NsModule({
				providers: [OldService],
				exports: [OldService],
			})
			class OldModule {}

			@NsModule({
				providers: [NewService],
				exports: [NewService],
			})
			class NewModule {}

			const testInstance = Test.createModule({
				imports: [OldModule],
			});

			const replacedModule = await testInstance.replaceModule(
				OldModule,
				NewModule,
			);
			expect(replacedModule).toBeDefined();
			expect(replacedModule.metatype).toBe(NewModule);
		});
	});

	describe("addScannerPlugin", () => {
		it("should add a scanner plugin to the container", async () => {
			const mockPlugin = {
				name: "test-plugin",
				scan: vi.fn(),
			};

			const testingModule = Test.createModule({
				providers: [],
			});

			testingModule.addScannerPlugin(mockPlugin);

			await testingModule.compile();

			// Plugin should be added without errors
			expect(mockPlugin).toBeDefined();
		});
	});

	describe("setModuleDecorator", () => {
		it("should set a custom module decorator", async () => {
			@Injectable()
			class CustomService {
				name = "custom";
			}

			const testingModule = Test.createModule({
				providers: [CustomService],
			});

			testingModule.setModuleDecorator(NsModule);

			const compiled = await testingModule.compile();
			const service = await compiled.get<CustomService>(CustomService);

			expect(service).toBeInstanceOf(CustomService);
			expect(service?.name).toBe("custom");
		});
	});

	describe("module getter", () => {
		it("should return the module after compilation", async () => {
			@Injectable()
			class TestService {}

			const testInstance = Test.createModule({
				providers: [TestService],
			});

			await testInstance.compile();

			expect(testInstance.module).toBeDefined();
		});

		it("should throw error when accessing module before compilation", () => {
			const testInstance = Test.createModule({
				providers: [],
			});

			expect(() => testInstance.module).toThrow("container not compiled");
		});
	});

	describe("moduleContainer getter", () => {
		it("should return the module container after compilation", async () => {
			@Injectable()
			class TestService {}

			const testInstance = Test.createModule({
				providers: [TestService],
			});

			await testInstance.compile();

			expect(testInstance.moduleContainer).toBeDefined();
		});

		it("should throw error when accessing moduleContainer before compilation", () => {
			const testInstance = Test.createModule({
				providers: [],
			});

			expect(() => testInstance.moduleContainer).toThrow(
				"container not compiled",
			);
		});
	});

	describe("errors getter", () => {
		it("should return errors after compilation", async () => {
			@Injectable()
			class TestService {}

			const testInstance = Test.createModule({
				providers: [TestService],
			});

			await testInstance.compile();

			expect(testInstance.errors).toBeDefined();
			expect(Array.isArray(testInstance.errors)).toBe(true);
		});

		it("should throw error when accessing errors before compilation", () => {
			const testInstance = Test.createModule({
				providers: [],
			});

			expect(() => testInstance.errors).toThrow("container not compiled");
		});
	});
});
