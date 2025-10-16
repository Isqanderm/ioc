import { HashTestingUtil } from "../src/core/hash-testing-util";

describe("HashTestingUtil", () => {
	let hashUtil: HashTestingUtil;

	beforeEach(() => {
		hashUtil = new HashTestingUtil();
	});

	describe("hashString", () => {
		it("should return a 64-character hash", async () => {
			const input = "test-string";
			const hash = await hashUtil.hashString(input);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});

		it("should return consistent hash for the same input", async () => {
			const input = "consistent-test";
			const hash1 = await hashUtil.hashString(input);
			const hash2 = await hashUtil.hashString(input);

			expect(hash1).toBe(hash2);
		});

		it("should handle empty strings", async () => {
			const hash = await hashUtil.hashString("");

			expect(hash).toBeDefined();
			// Empty string results in empty hash due to the algorithm
			expect(hash.length).toBe(0);
		});

		it("should handle single character strings", async () => {
			const hash = await hashUtil.hashString("a");

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
			// Should repeat the character
			expect(hash).toBe("a".repeat(64));
		});

		it("should handle long strings", async () => {
			const longString = "a".repeat(100);
			const hash = await hashUtil.hashString(longString);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});

		it("should create hash from characters in the input string", async () => {
			const input = "abc";
			const hash = await hashUtil.hashString(input);

			// The hash should only contain characters from the input
			for (const char of hash) {
				expect(input).toContain(char);
			}
		});

		it("should handle special characters", async () => {
			const input = "!@#$%^&*()";
			const hash = await hashUtil.hashString(input);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});

		it("should handle unicode characters", async () => {
			const input = "你好世界";
			const hash = await hashUtil.hashString(input);

			expect(hash).toBeDefined();
			expect(hash.length).toBe(64);
		});

		it("should produce different hashes for different inputs", async () => {
			const hash1 = await hashUtil.hashString("input1");
			const hash2 = await hashUtil.hashString("input2");

			// While the algorithm is deterministic, different inputs should produce different hashes
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("hashObject", () => {
		it("should return an empty string", async () => {
			const obj = { key: "value" };
			const hash = await hashUtil.hashObject(obj);

			expect(hash).toBe("");
		});

		it("should handle empty objects", async () => {
			const hash = await hashUtil.hashObject({});

			expect(hash).toBe("");
		});

		it("should handle nested objects", async () => {
			const obj = {
				level1: {
					level2: {
						value: "test",
					},
				},
			};
			const hash = await hashUtil.hashObject(obj);

			expect(hash).toBe("");
		});

		it("should handle arrays", async () => {
			const arr = [1, 2, 3, 4, 5];
			const hash = await hashUtil.hashObject(arr);

			expect(hash).toBe("");
		});

		it("should handle objects with various types", async () => {
			const obj = {
				string: "test",
				number: 42,
				boolean: true,
				null: null,
				undefined: undefined,
				array: [1, 2, 3],
				nested: { key: "value" },
			};
			const hash = await hashUtil.hashObject(obj);

			expect(hash).toBe("");
		});
	});

	describe("incrementString", () => {
		it("should return incrementing string values", () => {
			const value1 = hashUtil.incrementString();
			const value2 = hashUtil.incrementString();
			const value3 = hashUtil.incrementString();

			expect(value1).toBe("1");
			expect(value2).toBe("2");
			expect(value3).toBe("3");
		});

		it("should start from 1", () => {
			const newHashUtil = new HashTestingUtil();
			const value = newHashUtil.incrementString();

			expect(value).toBe("1");
		});

		it("should maintain state across multiple calls", () => {
			const values: string[] = [];
			for (let i = 0; i < 10; i++) {
				values.push(hashUtil.incrementString());
			}

			expect(values).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
		});

		it("should handle large increments", () => {
			const newHashUtil = new HashTestingUtil();

			// Call it 100 times
			for (let i = 0; i < 99; i++) {
				newHashUtil.incrementString();
			}

			const value = newHashUtil.incrementString();
			expect(value).toBe("100");
		});

		it("should be independent for different instances", () => {
			const util1 = new HashTestingUtil();
			const util2 = new HashTestingUtil();

			const value1a = util1.incrementString();
			const value2a = util2.incrementString();
			const value1b = util1.incrementString();
			const value2b = util2.incrementString();

			expect(value1a).toBe("1");
			expect(value2a).toBe("1");
			expect(value1b).toBe("2");
			expect(value2b).toBe("2");
		});
	});

	describe("HashUtilInterface implementation", () => {
		it("should implement all required methods", () => {
			expect(hashUtil.hashString).toBeDefined();
			expect(hashUtil.hashObject).toBeDefined();
			expect(typeof hashUtil.hashString).toBe("function");
			expect(typeof hashUtil.hashObject).toBe("function");
		});

		it("should return promises from hash methods", () => {
			const stringPromise = hashUtil.hashString("test");
			const objectPromise = hashUtil.hashObject({});

			expect(stringPromise).toBeInstanceOf(Promise);
			expect(objectPromise).toBeInstanceOf(Promise);
		});
	});
});
