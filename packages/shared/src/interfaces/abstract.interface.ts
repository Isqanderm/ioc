/**
 * An abstract (or concrete) class whose instances are `T`. Written as an
 * abstract construct signature so that plain functions are not accepted where
 * a class token is expected (`Function.prototype` is `any`, so a
 * `{ prototype: T }` shape would admit every function and infer `any`).
 */
// biome-ignore lint/suspicious/noExplicitAny: constructor arguments are unknown to the container
export type Abstract<T> = abstract new (...args: any[]) => T;
