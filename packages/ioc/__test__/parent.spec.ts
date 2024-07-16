import { Inject, Injectable } from "../src";
import { Module } from "../src";
import { NexusApplicationsServer } from "../src/core/nexus-applications.server";
import { TestingContainer } from "../src/testing-utils";

describe("Parent container", () => {
	it("base parent", async () => {
		@Injectable()
		class ParentService {}

		@Injectable()
		class ChildService {
			constructor(
				@Inject(ParentService)
				public readonly parentService: ParentService,
			) {}
		}

		const parentContainer = TestingContainer.createTestingContainer({
			providers: [ParentService],
		});
		await parentContainer.compile();

		const childContainer = await TestingContainer.createTestingContainer({
			providers: [ChildService],
		})
			.parent(parentContainer)
			.compile();

		const childService = await childContainer.get<ChildService>(ChildService);

		expect(childService?.parentService).toBeInstanceOf(ParentService);
	});

	it("parent with NexusApplicationsServer", async () => {
		@Injectable()
		class ParentService {}

		@Injectable()
		class ChildService {
			constructor(
				@Inject(ParentService)
				public readonly parentService: ParentService,
			) {}
		}

		@Module({
			providers: [ParentService],
		})
		class ParentModule {}

		@Module({
			providers: [ChildService],
		})
		class ChildModule {}

		const parentContainer = NexusApplicationsServer.create(ParentModule);
		await parentContainer.bootstrap();

		const childContainer = await NexusApplicationsServer.create(ChildModule)
			.parent(parentContainer)
			.bootstrap();

		const childService = await childContainer.get<ChildService>(ChildService);

		expect(childService?.parentService).toBeInstanceOf(ParentService);
	});
});
