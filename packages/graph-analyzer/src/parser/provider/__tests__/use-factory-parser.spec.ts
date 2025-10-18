import { UseFactoryParser } from "../use-factory-parser";

describe("UseFactoryParser", () => {
	describe("Basic Functionality", () => {
		it("should parse provide and useFactory", () => {
			const provider = '{ provide: "LOGGER", useFactory: () => { return new Logger(); } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.type).toBe("UseFactory");
			expect(parser.token).toBe("LOGGER");
			expect(parser.value).toContain("Logger");
		});

		it("should parse factory with inject array", () => {
			const provider = '{ provide: "SERVICE", useFactory: (config) => { return new Service(config); }, inject: [ConfigService, DatabaseService] }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("SERVICE");
			expect(parser.inject).toHaveLength(2);
			expect(parser.inject).toContain("ConfigService");
			expect(parser.inject).toContain("DatabaseService");
		});

		it("should handle whitespace in provider string", () => {
			const provider = '{  provide:  "FACTORY"  ,  useFactory:  () => { return {}; }  }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("FACTORY");
		});
	});

	describe("Token Extraction", () => {
		it("should extract token from provide field", () => {
			const provider = '{ provide: "DATABASE_CONNECTION", useFactory: () => { return db; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("DATABASE_CONNECTION");
		});

		it("should handle token with underscores", () => {
			const provider = '{ provide: "API_CLIENT", useFactory: () => { return client; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("API_CLIENT");
		});

		it("should handle token with numbers", () => {
			const provider = '{ provide: "SERVICE_V2", useFactory: () => { return service; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("SERVICE_V2");
		});
	});

	describe("Factory Function Extraction", () => {
		it("should extract simple arrow function", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => { return value; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.value).toBe("() => { return value; }");
		});

		it("should extract factory with parameters", () => {
			const provider = '{ provide: "TOKEN", useFactory: (dep1, dep2) => { return new Service(dep1, dep2); } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.value).toContain("dep1");
			expect(parser.value).toContain("dep2");
		});

		it("should extract factory with complex body", () => {
			const provider = '{ provide: "TOKEN", useFactory: (config) => { const service = new Service(); service.init(config); return service; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.value).toContain("Service");
			expect(parser.value).toContain("init");
		});
	});

	describe("Inject Array Extraction", () => {
		it("should extract single inject dependency", () => {
			const provider = '{ provide: "TOKEN", useFactory: (dep) => { return dep; }, inject: [ConfigService] }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.inject).toHaveLength(1);
			expect(parser.inject[0]).toBe("ConfigService");
		});

		it("should extract multiple inject dependencies", () => {
			const provider = '{ provide: "TOKEN", useFactory: (a, b, c) => { return {}; }, inject: [ServiceA, ServiceB, ServiceC] }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.inject).toHaveLength(3);
			expect(parser.inject).toEqual(["ServiceA", "ServiceB", "ServiceC"]);
		});

		it("should handle inject with whitespace", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {}, inject: [ ServiceA , ServiceB , ServiceC ] }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.inject).toHaveLength(3);
			expect(parser.inject).toEqual(["ServiceA", "ServiceB", "ServiceC"]);
		});

		it("should return empty array when no inject", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => { return {}; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.inject).toEqual([]);
		});
	});

	describe("Edge Cases", () => {
		it("should return null for missing provide", () => {
			const provider = '{ useFactory: () => { return {}; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBeNull();
		});

		it("should return null for missing useFactory", () => {
			const provider = '{ provide: "TOKEN" }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("TOKEN");
			expect(parser.value).toBeNull();
		});

		it("should handle empty inject array", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {}, inject: [] }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.inject).toEqual([]);
		});

		it("should handle provider with extra fields", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {}, scope: "singleton", inject: [Service] }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.token).toBe("TOKEN");
			expect(parser.inject).toHaveLength(1);
		});
	});

	describe("Type Property", () => {
		it("should always return UseFactory as type", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {} }';
			const parser = new UseFactoryParser(provider);
			
			expect(parser.type).toBe("UseFactory");
		});

		it("should have type property before parsing", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {} }';
			const parser = new UseFactoryParser(provider);
			
			expect(parser.type).toBe("UseFactory");
		});
	});

	describe("Chaining", () => {
		it("should return itself from parse method", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {} }';
			const parser = new UseFactoryParser(provider);
			const result = parser.parse();

			expect(result).toBe(parser);
		});

		it("should allow method chaining", () => {
			const provider = '{ provide: "TOKEN", useFactory: () => {}, inject: [Service] }';
			const parser = new UseFactoryParser(provider);
			
			const inject = parser.parse().inject;
			expect(inject).toHaveLength(1);
		});
	});

	describe("Complex Scenarios", () => {
		it("should handle factory returning object literal", () => {
			const provider = '{ provide: "CONFIG", useFactory: () => { return { key: "value" }; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.value).toContain("key");
			expect(parser.value).toContain("value");
		});

		it("should handle factory with nested functions", () => {
			const provider = '{ provide: "TOKEN", useFactory: (service) => { return service.getData(); } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.value).toContain("getData");
		});

		it("should handle factory with conditional logic", () => {
			const provider = '{ provide: "TOKEN", useFactory: (env) => { return env === "prod" ? prodService : devService; } }';
			const parser = new UseFactoryParser(provider);
			parser.parse();

			expect(parser.value).toContain("prod");
			expect(parser.value).toContain("devService");
		});
	});
});

