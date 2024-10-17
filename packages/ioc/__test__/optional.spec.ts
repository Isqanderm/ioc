import { Test } from "@nexus-ioc/testing";
import { Inject, Injectable } from "../src";
import { Optional } from "../src/decorators/optional";

describe("Optional Dependency", () => {
	it("should dont show error with Optional decorator in Class Provider", async () => {
		@Injectable()
		class DependencyService {}

		@Injectable()
		class TestService {
			constructor(
				@Inject(DependencyService)
				@Optional()
				private readonly dependencyService?: DependencyService,
			) {}
		}

		const container = await Test.createModule({
			providers: [TestService],
		}).compile();

		expect(container.errors).toEqual([]);
	});

	it("should dont show error with Optional decorator in useClass Provider", async () => {
		@Injectable()
		class DependencyService {}

		@Injectable()
		class TestService {
			constructor(
				@Inject(DependencyService)
				@Optional()
				private readonly dependencyService?: DependencyService,
			) {}
		}

		const container = await Test.createModule({
			providers: [
				{
					provide: "TestService",
					useClass: TestService,
				},
			],
		}).compile();

		expect(container.errors).toEqual([]);
	});

	it("should show error with Optional decorator in useClass Provider", async () => {
		@Injectable()
		class DependencyService {}

		@Injectable()
		class TestService {
			constructor(
				@Inject(DependencyService)
				private readonly dependencyService?: DependencyService,
			) {}
		}

		const container = await Test.createModule({
			providers: [
				{
					provide: "TestService",
					useClass: TestService,
				},
			],
		}).compile();

		expect(container.errors).toEqual([
			{
				dependency: "DependencyService",
				position: 0,
				token: "TestService",
				type: "UNREACHED_DEP_CONSTRUCTOR",
			},
		]);
	});

	it("should show error with Optional decorator in Class Provider", async () => {
		@Injectable()
		class DependencyService {}

		@Injectable()
		class TestService {
			constructor(
				@Inject(DependencyService)
				private readonly dependencyService?: DependencyService,
			) {}
		}

		const container = await Test.createModule({
			providers: [TestService],
		}).compile();

		expect(container.errors).toEqual([
			{
				dependency: "DependencyService",
				position: 0,
				token: "TestService",
				type: "UNREACHED_DEP_CONSTRUCTOR",
			},
		]);
	});
});
