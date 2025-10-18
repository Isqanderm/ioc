import { UseValueParser } from "../use-value-parser";

describe("UseValueParser", () => {
	describe("Basic Functionality", () => {
		it("should parse provide and useValue", () => {
			const provider = '{ provide: "CONFIG", useValue: "production" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.type).toBe("UseValue");
			expect(parser.token).toBe("CONFIG");
			expect(parser.value).toBe("production");
		});

		it("should handle whitespace in provider string", () => {
			const provider = '{  provide:  "API_KEY"  ,  useValue:  "secret123"  }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("API_KEY");
			expect(parser.value).toBe("secret123");
		});

		it("should parse provider with different value types", () => {
			const provider = '{ provide: "PORT", useValue: "8080" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("PORT");
			expect(parser.value).toBe("8080");
		});
	});

	describe("Token Extraction", () => {
		it("should extract token from provide field", () => {
			const provider = '{ provide: "DATABASE_URL", useValue: "localhost" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("DATABASE_URL");
		});

		it("should handle token with underscores", () => {
			const provider = '{ provide: "API_BASE_URL", useValue: "https://api.example.com" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("API_BASE_URL");
		});

		it("should handle token with numbers", () => {
			const provider = '{ provide: "CONFIG_V2", useValue: "value" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("CONFIG_V2");
		});
	});

	describe("Value Extraction", () => {
		it("should extract value from useValue field", () => {
			const provider = '{ provide: "ENV", useValue: "development" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.value).toBe("development");
		});

		it("should handle empty value", () => {
			const provider = '{ provide: "EMPTY", useValue: "" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			// Empty string doesn't match the regex, so it returns null
			expect(parser.value).toBeNull();
		});

		it("should handle value with special characters", () => {
			const provider = '{ provide: "URL", useValue: "https://example.com/api?key=123" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.value).toBe("https://example.com/api?key=123");
		});
	});

	describe("Edge Cases", () => {
		it("should return null for missing provide", () => {
			const provider = '{ useValue: "value" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBeNull();
			expect(parser.value).toBe("value");
		});

		it("should return null for missing useValue", () => {
			const provider = '{ provide: "TOKEN" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("TOKEN");
			expect(parser.value).toBeNull();
		});

		it("should handle malformed provider string", () => {
			const provider = '{ provide: "TOKEN", useValue }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("TOKEN");
			expect(parser.value).toBeNull();
		});

		it("should handle provider with extra fields", () => {
			const provider = '{ provide: "TOKEN", useValue: "value", scope: "singleton" }';
			const parser = new UseValueParser(provider);
			parser.parse();

			expect(parser.token).toBe("TOKEN");
			expect(parser.value).toBe("value");
		});
	});

	describe("Type Property", () => {
		it("should always return UseValue as type", () => {
			const provider = '{ provide: "TOKEN", useValue: "value" }';
			const parser = new UseValueParser(provider);

			expect(parser.type).toBe("UseValue");
		});

		it("should have type property before parsing", () => {
			const provider = '{ provide: "TOKEN", useValue: "value" }';
			const parser = new UseValueParser(provider);

			expect(parser.type).toBe("UseValue");
		});
	});

	describe("Chaining", () => {
		it("should return itself from parse method", () => {
			const provider = '{ provide: "TOKEN", useValue: "value" }';
			const parser = new UseValueParser(provider);
			const result = parser.parse();

			expect(result).toBe(parser);
		});

		it("should allow method chaining", () => {
			const provider = '{ provide: "TOKEN", useValue: "value" }';
			const parser = new UseValueParser(provider);

			const token = parser.parse().token;
			expect(token).toBe("TOKEN");
		});
	});
});

