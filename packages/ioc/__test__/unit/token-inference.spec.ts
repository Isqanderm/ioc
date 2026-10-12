import "reflect-metadata";
import {
	Injectable,
	InjectionToken,
	inject,
	Module,
	type ModuleRef,
	NexusApplication,
	Scope,
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
		// The expected type supplies T for string tokens.
		const fromContext: number = app.get("S");
		expect(fromContext).toBe(1);
	});

	it("tokens of different T are not interchangeable", () => {
		const A = new InjectionToken<string>("A");
		const B = new InjectionToken<number>("B");
		expectTypeOf(A).not.toEqualTypeOf(B);
	});

	it("rejects tokens unrelated to the requested type", async () => {
		const app = await NexusApplication.create(M).bootstrap();
		class Foo {
			foo = 1;
		}
		class Bar {
			bar = "b";
		}
		const arbitrary = (x: number) => x;
		// Type-level only: these calls are never executed.
		const unreachable = () => {
			// @ts-expect-error Bar is not a token for Foo
			app.get<Foo>(Bar);
			// @ts-expect-error an arbitrary function is not a provider token
			app.get(arbitrary);
			// @ts-expect-error a plain object is not an InjectionToken
			app.get({ description: "x" });
		};
		expect(typeof unreachable).toBe("function");
	});

	it("InjectionToken is nominal", () => {
		// @ts-expect-error structural look-alikes are not InjectionTokens
		const t: InjectionToken<string> = { description: "x", toString: () => "" };
		expect(t).toBeDefined();
		const narrow = new InjectionToken<"a">("narrow");
		const wide: InjectionToken<string> = narrow;
		expectTypeOf(narrow).toExtend<InjectionToken<string>>();
		expect(wide).toBe(narrow);
	});

	it("infers from abstract class tokens", async () => {
		abstract class Base {
			abstract name(): string;
		}
		class Impl extends Base {
			name() {
				return "impl";
			}
		}
		@Module({ providers: [{ provide: Base, useClass: Impl }] })
		class AbstractModule {}
		const app = await NexusApplication.create(AbstractModule).bootstrap();
		expectTypeOf(app.get(Base)).toEqualTypeOf<Base>();
		expect(app.get(Base).name()).toBe("impl");
	});

	it("infers InjectionToken types on ModuleRef.get / resolve", () => {
		// Type-level only: never called.
		const check = (ref: ModuleRef) => {
			expectTypeOf(ref.get(CONFIG)).toEqualTypeOf<Config | undefined>();
			expectTypeOf(ref.resolve(CONFIG)).toEqualTypeOf<
				Promise<Config | undefined>
			>();
			expectTypeOf(ref.get(Svc)).toEqualTypeOf<Svc | undefined>();
		};
		expect(typeof check).toBe("function");
	});

	it("infers types for inject()", () => {
		// Type-level only: inject() throws outside an injection context.
		const check = () => {
			expectTypeOf(inject(CONFIG)).toEqualTypeOf<Config>();
			expectTypeOf(inject(CONFIG, { optional: true })).toEqualTypeOf<
				Config | undefined
			>();
			expectTypeOf(inject(Svc)).toEqualTypeOf<Svc>();
		};
		expect(typeof check).toBe("function");
	});
});

describe("Scope enum", () => {
	it("no longer has Scoped", () => {
		// @ts-expect-error Scoped was removed
		expect(Scope.Scoped).toBeUndefined();
	});
});
