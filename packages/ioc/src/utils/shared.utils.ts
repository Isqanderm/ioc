// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isUndefined = (obj: any): obj is undefined =>
	typeof obj === "undefined";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isObject = (fn: any): fn is object =>
	!isNil(fn) && typeof fn === "object";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isPlainObject = (fn: any): fn is object => {
	if (!isObject(fn)) {
		return false;
	}
	const proto = Object.getPrototypeOf(fn);
	if (proto === null) {
		return true;
	}
	const ctor =
		Object.prototype.hasOwnProperty.call(proto, "constructor") &&
		proto.constructor;
	return (
		typeof ctor === "function" &&
		ctor instanceof ctor &&
		Function.prototype.toString.call(ctor) ===
			Function.prototype.toString.call(Object)
	);
};

export const addLeadingSlash = (path?: string): string =>
	path && typeof path === "string"
		? path.charAt(0) !== "/"
			? // biome-ignore lint/style/useTemplate: <explanation>
				"/" + path
			: path
		: "";

export const normalizePath = (path?: string): string =>
	path
		? path.startsWith("/")
			? // biome-ignore lint/style/useTemplate: <explanation>
				("/" + path.replace(/\/+$/, "")).replace(/\/+/g, "/")
			: // biome-ignore lint/style/useTemplate: <explanation>
				"/" + path.replace(/\/+$/, "")
		: "/";

export const stripEndSlash = (path: string) =>
	path[path.length - 1] === "/" ? path.slice(0, path.length - 1) : path;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
// biome-ignore lint/complexity/noBannedTypes: <explanation>
export const isFunction = (val: any): val is Function =>
	typeof val === "function";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isString = (val: any): val is string => typeof val === "string";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isNumber = (val: any): val is number => typeof val === "number";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isConstructor = (val: any): boolean => val === "constructor";

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isNil = (val: any): val is null | undefined =>
	isUndefined(val) || val === null;

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isEmpty = (array: any): boolean => !(array && array.length > 0);

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export const isSymbol = (val: any): val is symbol => typeof val === "symbol";
