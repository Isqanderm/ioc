import { describe, expect, it } from "vitest";
import { HashUtil } from "../../src/utils/hash-utils";

describe("HashUtil", () => {
	describe("hashString", () => {
		it("should hash a simple string", async () => {
			const hashUtil = new HashUtil();
			const result = await hashUtil.hashString("test");
			expect(result).toBe("364492");
		});

		it("should hash an empty string", async () => {
			const hashUtil = new HashUtil();
			const result = await hashUtil.hashString("");
			expect(result).toBe("0");
		});

		it("should produce consistent hashes for same input", async () => {
			const hashUtil = new HashUtil();
			const result1 = await hashUtil.hashString("hello");
			const result2 = await hashUtil.hashString("hello");
			expect(result1).toBe(result2);
		});

		it("should produce different hashes for different inputs", async () => {
			const hashUtil = new HashUtil();
			const result1 = await hashUtil.hashString("hello");
			const result2 = await hashUtil.hashString("world");
			expect(result1).not.toBe(result2);
		});
	});

	describe("hashObject", () => {
		it("should hash a simple object", async () => {
			const hashUtil = new HashUtil();
			const result = await hashUtil.hashObject({ key: "value" });
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
		});

		it("should hash an empty object", async () => {
			const hashUtil = new HashUtil();
			const result = await hashUtil.hashObject({});
			expect(typeof result).toBe("string");
		});

		it("should produce consistent hashes for same object", async () => {
			const hashUtil = new HashUtil();
			const obj = { name: "test", value: 123 };
			const result1 = await hashUtil.hashObject(obj);
			const result2 = await hashUtil.hashObject(obj);
			expect(result1).toBe(result2);
		});

		it("should produce different hashes for different objects", async () => {
			const hashUtil = new HashUtil();
			const result1 = await hashUtil.hashObject({ a: 1 });
			const result2 = await hashUtil.hashObject({ b: 2 });
			expect(result1).not.toBe(result2);
		});
	});

	describe("incrementString", () => {
		it("should start from 0", () => {
			const hashUtil = new HashUtil();
			const result = hashUtil.incrementString();
			expect(result).toBe("0");
		});

		it("should increment on each call", () => {
			const hashUtil = new HashUtil();
			expect(hashUtil.incrementString()).toBe("0");
			expect(hashUtil.incrementString()).toBe("1");
			expect(hashUtil.incrementString()).toBe("2");
		});

		it("should maintain separate counters for different instances", () => {
			const hashUtil1 = new HashUtil();
			const hashUtil2 = new HashUtil();
			expect(hashUtil1.incrementString()).toBe("0");
			expect(hashUtil2.incrementString()).toBe("0");
			expect(hashUtil1.incrementString()).toBe("1");
			expect(hashUtil2.incrementString()).toBe("1");
		});
	});
});
