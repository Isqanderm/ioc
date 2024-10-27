import "reflect-metadata";
import { Test } from "@nexus-ioc/testing";
import { NsModule } from "../src/decorators/ns-module";

describe("ModuleContainer", () => {
	class ServiceA {}
	class ServiceB {}

	it("should initialize with the given metatype", async () => {
		const TestModule = await Test.createModule({
			imports: [],
			providers: [ServiceA, ServiceB],
			exports: [ServiceA],
		}).compile();

		expect(await TestModule.imports).toEqual([]);
		expect(TestModule.providers).toEqual([ServiceA, ServiceB]);
		expect(TestModule.exports).toEqual([ServiceA]);
	});

	it("should allow setting and getting the token", async () => {
		const TestModule = await Test.createModule({
			imports: [],
			providers: [ServiceA, ServiceB],
			exports: [ServiceA],
		}).compile();

		expect(TestModule.token).toBeDefined();
	});

	it("should return empty arrays if metadata is not defined", async () => {
		const EmptyModule = await Test.createModule({}).compile();

		expect(await EmptyModule.imports).toEqual([]);
		expect(EmptyModule.providers).toEqual([]);
		expect(EmptyModule.exports).toEqual([]);
	});

	it("should handle modules with imports", async () => {
		@NsModule({
			providers: [ServiceA, ServiceB],
			exports: [ServiceA],
		})
		class TestModule {}

		const WithImportsModuleContainer = Test.createModule({
			imports: [TestModule],
		});

		const WithImportsModule = await WithImportsModuleContainer.compile();

		await WithImportsModuleContainer.addModule(TestModule);
		const TestModuleContainer =
			await WithImportsModuleContainer.getModule(TestModule);

		expect(await WithImportsModule.imports).toEqual([TestModuleContainer]);
	});
});
