import "reflect-metadata";
import { Module } from "../../src";
import { Container } from "../../src/core/modules/container";
import { HashUtil } from "../../src/utils/hash-utils";

describe("ModulesContainer.removeModule", () => {
	it("drops the module so a later addModule recreates its container under the same token", async () => {
		@Module({})
		class Feature {}
		const container = new Container(new HashUtil());
		@Module({})
		class AppModule {}
		await container.run(AppModule);

		const before = await container.addModule(Feature);

		// biome-ignore lint/complexity/useLiteralKeys: private field, test-only
		const modulesContainer = (
			container as unknown as {
				modulesContainer: { removeModule(token: string): void };
			}
		).modulesContainer;
		modulesContainer.removeModule(before.token);

		expect(await container.getModule(Feature)).toBeUndefined();

		const after = await container.addModule(Feature);
		expect(after.token).toBe(before.token);
		expect(after).not.toBe(before);
	});
});
