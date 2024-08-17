import "reflect-metadata";
import { ModuleTokenFactory } from "../src/core/modules/module-token-factory";
import { NsModule } from "../src/decorators/NsModule";
import { hashUtilsMock } from "./hashUtils.mock";

describe("ModuleTokenFactory", () => {
	let factory: ModuleTokenFactory;

	beforeEach(() => {
		factory = new ModuleTokenFactory(hashUtilsMock);
	});

	@NsModule({})
	class TestModule {}

	it("should create a module token", async () => {
		const token = await factory.create(TestModule);
		expect(token).toBeDefined();
		expect(typeof token).toBe("string");
		expect(token.length).toBe(64); // SHA-256 hash length
	});

	it("should cache module tokens", async () => {
		const token1 = await factory.create(TestModule);
		const token2 = await factory.create(TestModule);
		expect(token1).toBe(token2);
	});

	it("should generate different tokens for different modules", async () => {
		class AnotherTestModule {}
		const token1 = await factory.create(TestModule);
		const token2 = await factory.create(AnotherTestModule);
		expect(token1).not.toBe(token2);
	});
});
