import "reflect-metadata";
import {
	addLeadingSlash,
	isConstructor,
	isEmpty,
	isFunction,
	isNil,
	isNumber,
	isObject,
	isPlainObject,
	isString,
	isSymbol,
	isUndefined,
	normalizePath,
	stripEndSlash,
} from "../../src/utils/shared.utils";

describe("Shared Utils", () => {
	describe("isUndefined", () => {
		it("should return true for undefined", () => {
			expect(isUndefined(undefined)).toBe(true);
		});

		it("should return false for null", () => {
			expect(isUndefined(null)).toBe(false);
		});

		it("should return false for defined values", () => {
			expect(isUndefined(0)).toBe(false);
			expect(isUndefined("")).toBe(false);
			expect(isUndefined(false)).toBe(false);
			expect(isUndefined({})).toBe(false);
		});
	});

	describe("isObject", () => {
		it("should return true for objects", () => {
			expect(isObject({})).toBe(true);
			expect(isObject([])).toBe(true);
			expect(isObject(new Date())).toBe(true);
		});

		it("should return false for null", () => {
			expect(isObject(null)).toBe(false);
		});

		it("should return false for undefined", () => {
			expect(isObject(undefined)).toBe(false);
		});

		it("should return false for primitives", () => {
			expect(isObject(123)).toBe(false);
			expect(isObject("string")).toBe(false);
			expect(isObject(true)).toBe(false);
		});

		it("should return false for functions", () => {
			expect(isObject(() => {})).toBe(false);
		});
	});

	describe("isPlainObject", () => {
		it("should return true for plain objects", () => {
			expect(isPlainObject({})).toBe(true);
			expect(isPlainObject({ a: 1, b: 2 })).toBe(true);
		});

		it("should return true for objects with null prototype", () => {
			const obj = Object.create(null);
			expect(isPlainObject(obj)).toBe(true);
		});

		it("should return false for arrays", () => {
			expect(isPlainObject([])).toBe(false);
		});

		it("should return false for class instances", () => {
			class TestClass {}
			expect(isPlainObject(new TestClass())).toBe(false);
		});

		it("should return false for Date objects", () => {
			expect(isPlainObject(new Date())).toBe(false);
		});

		it("should return false for null", () => {
			expect(isPlainObject(null)).toBe(false);
		});

		it("should return false for undefined", () => {
			expect(isPlainObject(undefined)).toBe(false);
		});

		it("should return false for primitives", () => {
			expect(isPlainObject(123)).toBe(false);
			expect(isPlainObject("string")).toBe(false);
		});
	});

	describe("addLeadingSlash", () => {
		it("should add leading slash to path without one", () => {
			expect(addLeadingSlash("path")).toBe("/path");
			expect(addLeadingSlash("path/to/resource")).toBe("/path/to/resource");
		});

		it("should not add leading slash if already present", () => {
			expect(addLeadingSlash("/path")).toBe("/path");
			expect(addLeadingSlash("/path/to/resource")).toBe("/path/to/resource");
		});

		it("should return empty string for undefined", () => {
			expect(addLeadingSlash(undefined)).toBe("");
		});

		it("should return empty string for non-string values", () => {
			expect(addLeadingSlash(null as unknown as string)).toBe("");
			expect(addLeadingSlash(123 as unknown as string)).toBe("");
		});

		it("should handle empty string", () => {
			expect(addLeadingSlash("")).toBe("");
		});
	});

	describe("normalizePath", () => {
		it("should normalize path with leading slash", () => {
			expect(normalizePath("/path")).toBe("/path");
			expect(normalizePath("/path/to/resource")).toBe("/path/to/resource");
		});

		it("should add leading slash to path without one", () => {
			expect(normalizePath("path")).toBe("/path");
			expect(normalizePath("path/to/resource")).toBe("/path/to/resource");
		});

		it("should remove trailing slashes", () => {
			expect(normalizePath("/path/")).toBe("/path");
			expect(normalizePath("/path///")).toBe("/path");
			expect(normalizePath("path/")).toBe("/path");
		});

		it("should normalize multiple consecutive slashes when path starts with /", () => {
			expect(normalizePath("/path//to///resource")).toBe("/path/to/resource");
			expect(normalizePath("///path//to///resource")).toBe("/path/to/resource");
		});

		it("should not normalize consecutive slashes when path doesn't start with /", () => {
			expect(normalizePath("path//to///resource")).toBe("/path//to///resource");
		});

		it("should return / for undefined", () => {
			expect(normalizePath(undefined)).toBe("/");
		});

		it("should return / for empty string", () => {
			expect(normalizePath("")).toBe("/");
		});
	});

	describe("stripEndSlash", () => {
		it("should remove trailing slash", () => {
			expect(stripEndSlash("/path/")).toBe("/path");
			expect(stripEndSlash("/path/to/resource/")).toBe("/path/to/resource");
		});

		it("should not modify path without trailing slash", () => {
			expect(stripEndSlash("/path")).toBe("/path");
			expect(stripEndSlash("/path/to/resource")).toBe("/path/to/resource");
		});

		it("should handle single slash", () => {
			expect(stripEndSlash("/")).toBe("");
		});
	});

	describe("isFunction", () => {
		it("should return true for functions", () => {
			expect(isFunction(() => {})).toBe(true);
			expect(isFunction(() => {})).toBe(true);
			expect(isFunction(class {})).toBe(true);
		});

		it("should return false for non-functions", () => {
			expect(isFunction({})).toBe(false);
			expect(isFunction(null)).toBe(false);
			expect(isFunction(undefined)).toBe(false);
			expect(isFunction(123)).toBe(false);
			expect(isFunction("string")).toBe(false);
		});
	});

	describe("isString", () => {
		it("should return true for strings", () => {
			expect(isString("")).toBe(true);
			expect(isString("hello")).toBe(true);
		});

		it("should return false for non-strings", () => {
			expect(isString(123)).toBe(false);
			expect(isString(null)).toBe(false);
			expect(isString(undefined)).toBe(false);
			expect(isString({})).toBe(false);
		});
	});

	describe("isNumber", () => {
		it("should return true for numbers", () => {
			expect(isNumber(0)).toBe(true);
			expect(isNumber(123)).toBe(true);
			expect(isNumber(-456)).toBe(true);
			expect(isNumber(3.14)).toBe(true);
		});

		it("should return false for non-numbers", () => {
			expect(isNumber("123")).toBe(false);
			expect(isNumber(null)).toBe(false);
			expect(isNumber(undefined)).toBe(false);
			expect(isNumber({})).toBe(false);
		});
	});

	describe("isConstructor", () => {
		it('should return true for "constructor" string', () => {
			expect(isConstructor("constructor")).toBe(true);
		});

		it("should return false for other strings", () => {
			expect(isConstructor("notConstructor")).toBe(false);
			expect(isConstructor("")).toBe(false);
		});

		it("should return false for non-strings", () => {
			expect(isConstructor(123)).toBe(false);
			expect(isConstructor(null)).toBe(false);
			expect(isConstructor(undefined)).toBe(false);
		});
	});

	describe("isNil", () => {
		it("should return true for null", () => {
			expect(isNil(null)).toBe(true);
		});

		it("should return true for undefined", () => {
			expect(isNil(undefined)).toBe(true);
		});

		it("should return false for defined values", () => {
			expect(isNil(0)).toBe(false);
			expect(isNil("")).toBe(false);
			expect(isNil(false)).toBe(false);
			expect(isNil({})).toBe(false);
		});
	});

	describe("isEmpty", () => {
		it("should return true for empty arrays", () => {
			expect(isEmpty([])).toBe(true);
		});

		it("should return true for null", () => {
			expect(isEmpty(null)).toBe(true);
		});

		it("should return true for undefined", () => {
			expect(isEmpty(undefined)).toBe(true);
		});

		it("should return false for non-empty arrays", () => {
			expect(isEmpty([1])).toBe(false);
			expect(isEmpty([1, 2, 3])).toBe(false);
		});

		it("should return false for objects with length property", () => {
			expect(isEmpty({ length: 1 })).toBe(false);
		});
	});

	describe("isSymbol", () => {
		it("should return true for symbols", () => {
			expect(isSymbol(Symbol())).toBe(true);
			expect(isSymbol(Symbol("test"))).toBe(true);
		});

		it("should return false for non-symbols", () => {
			expect(isSymbol("symbol")).toBe(false);
			expect(isSymbol(123)).toBe(false);
			expect(isSymbol(null)).toBe(false);
			expect(isSymbol(undefined)).toBe(false);
			expect(isSymbol({})).toBe(false);
		});
	});
});
