import { Module, NexusApplication } from "../src";

describe("Hierarchy of containers", () => {
	@Module({
		providers: [
			{
				provide: "first-module-provider",
				useValue: "first-module-provider-value",
			},
		],
	})
	class AppFirstModule {}

	@Module({
		providers: [],
	})
	class AppSecondModule {}

	@Module({
		providers: [],
	})
	class AppThirdModule {}

	it("should get provider from parent module", async () => {
		const firstApp = await NexusApplication.create(AppFirstModule).bootstrap();
		const secondApp =
			await NexusApplication.create(AppSecondModule).bootstrap();

		secondApp.setParent(firstApp);

		const firstModuleProvider = await secondApp.get<string>(
			"first-module-provider",
		);

		expect(firstModuleProvider).toEqual("first-module-provider-value");
	});

	it("should not get provider from third module", async () => {
		const _firstApp = await NexusApplication.create(AppFirstModule).bootstrap();
		const secondApp =
			await NexusApplication.create(AppSecondModule).bootstrap();
		const thirdApp = await NexusApplication.create(AppThirdModule).bootstrap();

		thirdApp.setParent(secondApp);
		// secondApp.setParent(firstApp);

		const firstModuleProvider = await secondApp.get<string>(
			"first-module-provider",
		);

		expect(firstModuleProvider).toEqual(undefined);
	});
});
