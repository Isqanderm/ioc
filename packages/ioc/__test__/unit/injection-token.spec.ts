import "reflect-metadata";
import {
	BootstrapError,
	Inject,
	Injectable,
	InjectionToken,
	Module,
	NexusApplication,
	Optional,
	ProviderNotFoundError,
} from "../../src";

interface Config {
	url: string;
}

describe("InjectionToken", () => {
	it("works as a provide token for useValue", async () => {
		const CONFIG = new InjectionToken<Config>("CONFIG");
		@Module({ providers: [{ provide: CONFIG, useValue: { url: "x" } }] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(CONFIG)).toEqual({ url: "x" });
	});

	it("two tokens with the same description are different tokens", async () => {
		const A = new InjectionToken<string>("SAME");
		const B = new InjectionToken<string>("SAME");
		@Module({
			providers: [
				{ provide: A, useValue: "a" },
				{ provide: B, useValue: "b" },
			],
		})
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.errors).toEqual([]);
		expect(app.get(A)).toBe("a");
		expect(app.get(B)).toBe("b");
	});

	it("is injectable via @Inject in constructors and properties", async () => {
		const CONFIG = new InjectionToken<Config>("CONFIG");
		@Injectable()
		class Svc {
			@Inject(CONFIG) readonly viaProp!: Config;
			constructor(@Inject(CONFIG) readonly viaCtor: Config) {}
		}
		@Module({ providers: [Svc, { provide: CONFIG, useValue: { url: "y" } }] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		const svc = app.get(Svc);
		expect(svc.viaCtor.url).toBe("y");
		expect(svc.viaProp.url).toBe("y");
	});

	it("respects module exports", async () => {
		const CONFIG = new InjectionToken<Config>("CONFIG");
		@Module({
			providers: [{ provide: CONFIG, useValue: { url: "z" } }],
			exports: [CONFIG],
		})
		class ConfigModule {}
		@Injectable()
		class Svc {
			constructor(@Inject(CONFIG) readonly cfg: Config) {}
		}
		@Module({ imports: [ConfigModule], providers: [Svc] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(Svc).cfg.url).toBe("z");
	});

	it("@Optional + missing InjectionToken injects undefined", async () => {
		const MISSING = new InjectionToken<Config>("MISSING");
		@Injectable()
		class Svc {
			constructor(@Inject(MISSING) @Optional() readonly cfg?: Config) {}
		}
		@Module({ providers: [Svc] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(app.get(Svc).cfg).toBeUndefined();
	});

	it("uses the description in errors and labels", async () => {
		const MISSING = new InjectionToken<Config>("MISSING_CFG");
		@Module({ providers: [] })
		class M {}
		const app = await NexusApplication.create(M).bootstrap();
		expect(() => app.get(MISSING)).toThrow(ProviderNotFoundError);
		expect(() => app.get(MISSING)).toThrow(/InjectionToken MISSING_CFG/);
		expect(String(MISSING)).toBe("InjectionToken MISSING_CFG");
	});

	it("an unexported InjectionToken dependency fails bootstrap with its description", async () => {
		const SECRET = new InjectionToken<Config>("SECRET_CFG");
		@Module({ providers: [{ provide: SECRET, useValue: { url: "s" } }] })
		class SecretModule {}
		@Injectable()
		class Consumer {
			constructor(@Inject(SECRET) readonly cfg: Config) {}
		}
		@Module({ imports: [SecretModule], providers: [Consumer] })
		class M {}
		const bootstrap = NexusApplication.create(M).bootstrap();
		await expect(bootstrap).rejects.toBeInstanceOf(BootstrapError);
		await expect(bootstrap).rejects.toThrow(/InjectionToken SECRET_CFG/);
	});
});
