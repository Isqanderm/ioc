import { type DynamicModule, Injectable, NsModule } from "../src";
import { TestingContainer } from "../src/testing-utils";

describe("forFeature/forFeatureAsync", () => {
	describe("forFeature", () => {
		it("should resolve a module with forFeature", async () => {
			const featureConfig = {
				provide: "FEATURE_CONFIG",
				useValue: { feature: true },
			};

			@NsModule({})
			class FeatureModule {
				static forFeature(): DynamicModule {
					return {
						module: FeatureModule,
						imports: [],
						providers: [featureConfig],
					};
				}
			}

			const container = await TestingContainer.createTestingContainer({
				imports: [FeatureModule.forFeature()],
			}).compile();

			const config =
				await container.get<(typeof featureConfig)["useValue"]>(
					"FEATURE_CONFIG",
				);

			expect(config).toEqual({ feature: true });
		});
	});

	describe("forFeatureAsync", () => {
		it("should resolve a module with forFeatureAsync", async () => {
			@Injectable()
			class ConfigService {
				featureEnabled = true;
			}

			@NsModule({})
			class FeatureModule {
				static forFeatureAsync(): DynamicModule {
					return {
						module: FeatureModule,
						imports: [],
						providers: [
							{
								provide: "FEATURE_FACTORY",
								useFactory: async (configService: ConfigService) => {
									return { feature: configService.featureEnabled };
								},
								inject: [ConfigService],
							},
							{ provide: ConfigService, useClass: ConfigService },
						],
					};
				}
			}

			const container = await TestingContainer.createTestingContainer({
				imports: [FeatureModule.forFeatureAsync()],
			}).compile();

			const config = await container.get<{ feature: true }>("FEATURE_FACTORY");

			expect(config).toEqual({ feature: true });
		});
	});
});
