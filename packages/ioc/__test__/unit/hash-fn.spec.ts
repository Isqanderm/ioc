import "reflect-metadata";
import { Injectable, Module, NexusApplication } from "../../src";
import { HashUtil } from "../../src/utils/hash-utils";

describe("NexusApplication options.hashFn", () => {
	it("uses the custom hash class for the app and passes it on to children", async () => {
		const owners: string[] = [];
		let current = "";
		class SpyHash extends HashUtil {
			constructor() {
				super();
				owners.push(current);
			}
		}
		const hashString = vi.spyOn(SpyHash.prototype, "hashString");
		const incrementString = vi.spyOn(SpyHash.prototype, "incrementString");

		@Injectable()
		class Local {}
		@Module({ providers: [Local] })
		class Child {}
		@Module({ children: [Child] })
		class App {}

		current = "app";
		const app = await NexusApplication.create(App, {
			hashFn: SpyHash,
		}).bootstrap();
		expect(owners).toEqual(["app"]);
		expect(hashString).toHaveBeenCalled();
		expect(incrementString).toHaveBeenCalled();

		hashString.mockClear();
		incrementString.mockClear();
		current = "child";
		const child = await app.createChild(Child);
		expect(owners).toEqual(["app", "child"]);
		expect(hashString).toHaveBeenCalled();
		expect(incrementString).toHaveBeenCalled();
		expect(child.get(Local)).toBeInstanceOf(Local);

		await app.close();
	});
});
