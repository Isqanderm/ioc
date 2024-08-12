import { Test } from "nexus-ioc-testing";
import { type DynamicModule, Inject, Injectable, NsModule } from "../src";

describe("forRoot/forRootAsync", () => {
	describe("forRoot", () => {
		it("should resolve a module with forFeature", async () => {
			const featureConfig = {
				provide: "FEATURE_CONFIG",
				useValue: { feature: true },
			};

			@NsModule({})
			class GlobalModule {
				static forRoot(): DynamicModule {
					return {
						module: GlobalModule,
						providers: [featureConfig],
						exports: ["FEATURE_CONFIG"],
					};
				}
			}

			@Injectable()
			class AppService {
				constructor(
					@Inject("FEATURE_CONFIG")
					public readonly config: { feature: boolean },
				) {}
			}

			@NsModule({
				providers: [AppService],
			})
			class AppModule {}

			const container = await Test.createModule({
				imports: [AppModule, GlobalModule.forRoot()],
				providers: [],
			}).compile();

			const appService = await container.get<AppService>(AppService);

			expect(appService?.config).toEqual({ feature: true });
		});
	});

	describe("forRootAsync", () => {
		it("should resolve a module with forFeatureAsync", async () => {
			@Injectable()
			class ConfigService {
				featureEnabled = true;
			}

			@NsModule({})
			class GlobalModule {
				static forRootAsync(): DynamicModule {
					return {
						module: GlobalModule,
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
						exports: ["FEATURE_FACTORY"],
					};
				}
			}

			@Injectable()
			class AppService {
				constructor(
					@Inject("FEATURE_FACTORY")
					public readonly config: { feature: boolean },
				) {}
			}

			@NsModule({
				providers: [AppService],
			})
			class AppModule {}

			const container = await Test.createModule({
				imports: [AppModule, GlobalModule.forRootAsync()],
			}).compile();

			const appService = await container.get<AppService>(AppService);

			expect(appService?.config).toEqual({ feature: true });
		});
	});
});
