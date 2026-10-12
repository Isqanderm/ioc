import "reflect-metadata";
import {
	Injectable,
	InjectionToken,
	Module,
	NexusApplication,
} from "../../src";

interface Config {
	url: string;
}
const CONFIG = new InjectionToken<Config>("CONFIG");

@Injectable()
class Svc {
	hello() {
		return "hi";
	}
}

@Module({
	providers: [
		Svc,
		{ provide: CONFIG, useValue: { url: "u" } },
		{ provide: "S", useValue: 1 },
	],
})
class M {}

describe("token type inference", () => {
	it("infers from class and InjectionToken", async () => {
		const app = await NexusApplication.create(M).bootstrap();
		expectTypeOf(app.get(Svc)).toEqualTypeOf<Svc>();
		expectTypeOf(app.get(CONFIG)).toEqualTypeOf<Config>();
		expectTypeOf(app.get(CONFIG, { optional: true })).toEqualTypeOf<
			Config | undefined
		>();
		expectTypeOf(app.resolve(CONFIG)).toEqualTypeOf<Promise<Config>>();
		expect(app.get(CONFIG).url).toBe("u");
	});

	it("string tokens need an explicit type and default to unknown", async () => {
		const app = await NexusApplication.create(M).bootstrap();
		expectTypeOf(app.get("S")).toEqualTypeOf<unknown>();
		expectTypeOf(app.get<number>("S")).toEqualTypeOf<number>();
		expectTypeOf(app.get<Svc>(Svc)).toEqualTypeOf<Svc>();
	});

	it("tokens of different T are not interchangeable", () => {
		const A = new InjectionToken<string>("A");
		const B = new InjectionToken<number>("B");
		expectTypeOf(A).not.toEqualTypeOf(B);
	});
});
