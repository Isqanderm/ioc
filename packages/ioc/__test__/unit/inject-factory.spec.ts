import "reflect-metadata";
import { InjectionToken, inject, Module, NexusApplication } from "../../src";

describe("inject() in factories", () => {
	it("works inside useFactory", async () => {
		const BASE = new InjectionToken<string>("BASE");
		const URL = new InjectionToken<string>("URL");
		@Module({
			providers: [
				{ provide: BASE, useValue: "https://x" },
				{ provide: URL, useFactory: () => `${inject(BASE)}/api` },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(URL)).toBe("https://x/api");
	});
});
