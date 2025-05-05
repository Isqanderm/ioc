import { NsModule } from "../src";
import { NexusApplicationsServer } from "../src/core/nexus-applications.server";

describe("Hierarchy of containers", () => {
	@NsModule({
		providers: [
			{
				provide: "first-module-provider",
				useValue: "first-module-provider-value",
			},
		],
	})
	class AppFirstModule {}

	@NsModule({
		providers: [],
	})
	class AppSecondModule {}

	@NsModule({
		providers: [],
	})
	class AppThirdModule {}

	it("should get provider from parent module", async () => {
		const firstApp =
			await NexusApplicationsServer.create(AppFirstModule).bootstrap();
		const secondApp =
			await NexusApplicationsServer.create(AppSecondModule).bootstrap();

		secondApp.setParent(firstApp);

		const firstModuleProvider = await secondApp.get<string>(
			"first-module-provider",
		);

		expect(firstModuleProvider).toEqual("first-module-provider-value");
	});

	it("should not get provider from third module", async () => {
		const firstApp =
			await NexusApplicationsServer.create(AppFirstModule).bootstrap();
		const secondApp =
			await NexusApplicationsServer.create(AppSecondModule).bootstrap();
		const thirdApp =
			await NexusApplicationsServer.create(AppThirdModule).bootstrap();

		thirdApp.setParent(secondApp);
		// secondApp.setParent(firstApp);

		const firstModuleProvider = await secondApp.get<string>(
			"first-module-provider",
		);

		expect(firstModuleProvider).toEqual(undefined);
	});
});
