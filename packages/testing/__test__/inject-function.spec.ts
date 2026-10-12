import "reflect-metadata";
import { Injectable, inject, Module } from "@nexus-ioc/core";
import { Test } from "../src/core/testing-container";

describe("inject() with Test containers", () => {
	@Injectable()
	class Http {
		name = "real";
	}

	@Injectable()
	class Api {
		http = inject(Http);
	}

	it("injects a real provider via inject()", async () => {
		const testing = await Test.createModule({
			providers: [Http, Api],
		}).compile();

		expect(testing.get(Api).http).toBe(testing.get(Http));
	});

	it("injects a fake provided with useValue", async () => {
		const fakeHttp = { name: "fake" };
		const testing = await Test.createModule({
			providers: [{ provide: Http, useValue: fakeHttp }, Api],
		}).compile();

		expect(testing.get(Api).http).toBe(fakeHttp);
	});

	it("uses the replacement module for an inject()-ed provider", async () => {
		const HTTP = Symbol("HTTP");

		@Injectable()
		class RealHttp {
			name = "real";
		}

		@Injectable()
		class FakeHttp {
			name = "fake";
		}

		@Module({
			providers: [{ provide: HTTP, useClass: RealHttp }],
			exports: [HTTP],
		})
		class HttpModule {}

		@Module({
			providers: [{ provide: HTTP, useClass: FakeHttp }],
			exports: [HTTP],
		})
		class FakeHttpModule {}

		@Injectable()
		class Client {
			http = inject<{ name: string }>(HTTP);
		}

		const creator = Test.createModule({
			imports: [HttpModule],
			providers: [Client],
		});
		await creator.replaceModule(HttpModule, FakeHttpModule);
		const testing = await creator.compile();

		expect(testing.get(Client).http.name).toBe("fake");
	});
});
